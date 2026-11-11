/**
 * Fork regression tests: the fail-closed policy for security hooks must keep
 * its documented escape hatch. When the user has switched the hooks off
 * (ECC_DISABLED_HOOKS), a broken hook dependency or an oversized request must
 * not block, because the BLOCKED message itself tells people to do exactly that.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-safety-optout-'));
process.once('exit', () => fs.rmSync(sandbox, { recursive: true, force: true }));

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

const VALID_BASH = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hello' } });
const SAFETY_SUBHOOKS = 'pre:bash:block-no-verify,pre:bash:gateguard-fact-force';

function hermeticEnv(extra) {
  const home = path.join(sandbox, 'home');
  fs.mkdirSync(home, { recursive: true });
  const env = {
    ...process.env, HOME: home, USERPROFILE: home, TEMP: home, TMP: home, TMPDIR: home,
    ECC_HOOK_PROFILE: 'standard',
  };
  for (const key of [
    'ECC_GATEGUARD', 'GATEGUARD_DISABLED', 'ECC_DISABLED_HOOKS', 'ECC_HOOKS_ENABLED', 'ECC_HOOK_CONFIG',
    'ECC_DRY_RUN', 'ECC_HOOK_INPUT_TRUNCATED_UPSTREAM', 'CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED',
    'CLAUDE_PLUGIN_OPTION_HOOK_PROFILE',
  ]) delete env[key];
  return { ...env, ...extra };
}

// A plugin root whose pre-Bash dispatcher cannot load: one non-security
// sub-hook has a syntax error.
function brokenPluginRoot() {
  const root = fs.mkdtempSync(path.join(sandbox, 'plugin-'));
  fs.cpSync(path.join(repoRoot, 'scripts', 'hooks'), path.join(root, 'scripts', 'hooks'), { recursive: true });
  fs.cpSync(path.join(repoRoot, 'scripts', 'lib'), path.join(root, 'scripts', 'lib'), { recursive: true });
  fs.appendFileSync(path.join(root, 'scripts', 'hooks', 'auto-tmux-dev.js'), '\nthis is not valid javascript (\n');
  return root;
}

function runViaBootstrap(root, env, input = VALID_BASH) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts', 'hooks', 'plugin-hook-bootstrap.js'), 'node', 'scripts/hooks/pre-bash-dispatcher.js'],
    {
      input, encoding: 'utf8', timeout: 60000,
      env: hermeticEnv({ CLAUDE_PLUGIN_ROOT: root, ECC_PLUGIN_ROOT: root, ...env }),
    }
  );
}

function runDispatcherDirect(env, input = VALID_BASH) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'hooks', 'pre-bash-dispatcher.js')], {
    input, encoding: 'utf8', timeout: 60000, env: hermeticEnv(env),
  });
}

console.log('\nsafety hooks keep their opt-out');

const root = brokenPluginRoot();

check('a dispatcher that cannot load blocks while the security hooks are enabled', () => {
  const r = runViaBootstrap(root, {});
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('a dispatcher that cannot load does not block once pre:bash:dispatcher is disabled', () => {
  const r = runViaBootstrap(root, { ECC_DISABLED_HOOKS: 'pre:bash:dispatcher' });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a dispatcher that cannot load does not block when every security sub-hook is disabled', () => {
  const r = runViaBootstrap(root, { ECC_DISABLED_HOOKS: SAFETY_SUBHOOKS });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('GateGuard off by its own switch plus block-no-verify disabled also opts out', () => {
  const r = runViaBootstrap(root, { ECC_DISABLED_HOOKS: 'pre:bash:block-no-verify', ECC_GATEGUARD: 'off' });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a broken load with only one security sub-hook disabled still blocks', () => {
  const r = runViaBootstrap(root, { ECC_DISABLED_HOOKS: 'pre:bash:block-no-verify' });
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
});

check('an oversized request blocks while a security sub-hook is enabled', () => {
  const r = runDispatcherDirect({ ECC_HOOK_INPUT_TRUNCATED_UPSTREAM: '1' }, '{"tool_name":"Bash"');
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
});

check('an oversized request does not block when every security sub-hook is disabled', () => {
  const r = runDispatcherDirect(
    { ECC_HOOK_INPUT_TRUNCATED_UPSTREAM: '1', ECC_DISABLED_HOOKS: SAFETY_SUBHOOKS },
    '{"tool_name":"Bash"'
  );
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a crashing run-with-flags entry for a disabled security hook is not turned into a block', () => {
  const fake = fs.mkdtempSync(path.join(sandbox, 'rwf-'));
  fs.mkdirSync(path.join(fake, 'scripts', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(fake, 'scripts', 'hooks', 'run-with-flags.js'), 'process.exit(1);\n');
  fs.cpSync(path.join(repoRoot, 'scripts', 'lib'), path.join(fake, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(
    path.join(repoRoot, 'scripts', 'hooks', 'plugin-hook-bootstrap.js'),
    path.join(fake, 'scripts', 'hooks', 'plugin-hook-bootstrap.js')
  );
  for (const file of ['hook-input.js', 'hook-input-limits.js', 'safety-hooks.js']) {
    fs.copyFileSync(path.join(repoRoot, 'scripts', 'hooks', file), path.join(fake, 'scripts', 'hooks', file));
  }
  const args = ['node', 'scripts/hooks/run-with-flags.js', 'pre:edit-write:gateguard-fact-force',
    'scripts/hooks/gateguard-fact-force.js', 'standard,strict'];
  const run = env => spawnSync(process.execPath, [path.join(fake, 'scripts', 'hooks', 'plugin-hook-bootstrap.js'), ...args], {
    input: VALID_BASH, encoding: 'utf8', timeout: 60000,
    env: hermeticEnv({ CLAUDE_PLUGIN_ROOT: fake, ECC_PLUGIN_ROOT: fake, ...env }),
  });
  assert.strictEqual(run({}).status, 2, 'enabled: a crash blocks');
  assert.notStrictEqual(
    run({ ECC_DISABLED_HOOKS: 'pre:edit-write:gateguard-fact-force' }).status, 2,
    'disabled: the crash must not block'
  );
});

check('the dispatcher declares exactly the security sub-hooks and profiles safety-hooks.js lists', () => {
  const { PRE_BASH_SAFETY_HOOKS } = require('../../scripts/hooks/safety-hooks');
  const { PRE_BASH_HOOKS } = require('../../scripts/hooks/bash-hook-dispatcher');
  const declared = PRE_BASH_HOOKS.filter(hook => hook.safety).map(hook => ({ id: hook.id, profiles: hook.profiles }));
  assert.deepStrictEqual(declared, PRE_BASH_SAFETY_HOOKS.map(hook => ({ id: hook.id, profiles: hook.profiles })));
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
