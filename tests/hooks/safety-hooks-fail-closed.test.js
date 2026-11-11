/**
 * Fork regression tests: enabled security hooks must fail closed.
 *
 * Claude Code treats PreToolUse exit 2 as "block" and any other non-zero as a
 * non-blocking error (the tool still runs). A security hook that cannot parse
 * its input, cannot load, or crashes therefore must exit 2, not 0 or 1.
 * Non-security hooks keep their non-interrupting behaviour.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const runner = path.join(repoRoot, 'scripts', 'hooks', 'run-with-flags.js');
const bootstrap = path.join(repoRoot, 'scripts', 'hooks', 'plugin-hook-bootstrap.js');
const preBashDispatcher = path.join(repoRoot, 'scripts', 'hooks', 'pre-bash-dispatcher.js');

const GATEGUARD_PS = 'pre:powershell:gateguard-fact-force';
const GATEGUARD_SCRIPT = 'scripts/hooks/gateguard-fact-force.js';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-safety-failclosed-'));
process.once('exit', () => fs.rmSync(sandbox, { recursive: true, force: true }));

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    return true;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    return false;
  }
}

function hermeticEnv(extra = {}) {
  const home = path.join(sandbox, 'home');
  fs.mkdirSync(home, { recursive: true });
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    TEMP: home,
    TMP: home,
    TMPDIR: home,
    ECC_HOOK_PROFILE: 'standard',
    ...extra
  };
  delete env.ECC_GATEGUARD;
  delete env.GATEGUARD_DISABLED;
  delete env.ECC_DISABLED_HOOKS;
  delete env.ECC_HOOKS_ENABLED;
  delete env.ECC_HOOK_CONFIG;
  delete env.ECC_DRY_RUN;
  delete env.CLAUDE_PLUGIN_OPTION_HOOKS_ENABLED;
  delete env.CLAUDE_PLUGIN_OPTION_HOOK_PROFILE;
  return { ...env, ...extra };
}

function runNode(script, args, input, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    input,
    encoding: 'utf8',
    env: hermeticEnv(env),
    cwd: repoRoot,
    timeout: 30000
  });
}

function makePluginRoot(files) {
  const root = fs.mkdtempSync(path.join(sandbox, 'plugin-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return root;
}

const VALID_BASH = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hello' } });

let passed = 0;
let failed = 0;
function check(name, fn) {
  if (test(name, fn)) passed++;
  else failed++;
}

console.log('\nsafety hooks fail closed: run-with-flags.js');

check('enabled GateGuard blocks (exit 2) when tool_name is not a string', () => {
  const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'],
    JSON.stringify({ tool_name: 42, tool_input: { command: 'echo hello' } }));
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('enabled GateGuard blocks when stdin is not complete JSON', () => {
  const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'], '{');
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('enabled GateGuard blocks when stdin JSON is not an object', () => {
  for (const raw of ['null', '[]', '"x"', '7']) {
    const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'], raw);
    assert.strictEqual(r.status, 2, `raw ${raw}: status ${r.status}; stderr: ${r.stderr}`);
  }
});

check('enabled config-protection blocks on invalid JSON', () => {
  const r = runNode(runner, ['pre:config-protection', 'scripts/hooks/config-protection.js', 'standard,strict'], '{ nope');
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('enabled safety hook with a missing script blocks', () => {
  const root = makePluginRoot({});
  const r = runNode(runner, [GATEGUARD_PS, 'scripts/hooks/does-not-exist.js', 'standard,strict'], VALID_BASH,
    { CLAUDE_PLUGIN_ROOT: root });
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('enabled safety hook whose run() throws blocks', () => {
  const root = makePluginRoot({
    'scripts/hooks/boom.js': "exports.run = function run() { throw new Error('kaboom'); };\n"
  });
  const r = runNode(runner, [GATEGUARD_PS, 'scripts/hooks/boom.js', 'standard,strict'], VALID_BASH,
    { CLAUDE_PLUGIN_ROOT: root });
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
  assert.match(r.stderr, /kaboom/);
});

check('enabled safety hook run as a legacy child that times out blocks (not exit 1)', () => {
  const root = makePluginRoot({
    'scripts/hooks/hang.js': 'setInterval(() => {}, 1000);\n'
  });
  const r = runNode(runner, [GATEGUARD_PS, 'scripts/hooks/hang.js', 'standard,strict'], VALID_BASH,
    { CLAUDE_PLUGIN_ROOT: root, ECC_HOOK_DEADLINE_MS: String(Date.now() + 1500) });
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('a valid payload still reaches GateGuard normally (no false block)', () => {
  const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'], VALID_BASH);
  assert.notStrictEqual(r.status, 2, `unexpected block; stderr: ${r.stderr}`);
});

check('GateGuard explicitly disabled by env keeps allowing malformed input', () => {
  const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'], '{', { ECC_GATEGUARD: 'off' });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a hook disabled by the profile is not forced to block', () => {
  const r = runNode(runner, [GATEGUARD_PS, GATEGUARD_SCRIPT, 'strict'], '{', { ECC_HOOK_PROFILE: 'minimal' });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

check('non-security hooks keep failing open on the same failures', () => {
  const root = makePluginRoot({
    'scripts/hooks/boom.js': "exports.run = function run() { throw new Error('kaboom'); };\n",
    'scripts/hooks/hang.js': 'setInterval(() => {}, 1000);\n'
  });
  const id = 'pre:write:doc-file-warning';
  const env = { CLAUDE_PLUGIN_ROOT: root };
  let r = runNode(runner, [id, 'scripts/hooks/boom.js', 'standard,strict'], '{', env);
  assert.strictEqual(r.status, 0, `throw: status ${r.status}; stderr: ${r.stderr}`);
  r = runNode(runner, [id, 'scripts/hooks/missing.js', 'standard,strict'], '{', env);
  assert.strictEqual(r.status, 0, `missing: status ${r.status}; stderr: ${r.stderr}`);
});

console.log('\nsafety hooks fail closed: bash dispatcher');

check('pre-bash dispatcher blocks when stdin ends mid-JSON', () => {
  const r = runNode(preBashDispatcher, [], '{');
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('runPreBash blocks when a safety sub-hook throws, ignores a throwing non-safety sub-hook', () => {
  const dispatcherPath = require.resolve(path.join(repoRoot, 'scripts', 'hooks', 'bash-hook-dispatcher.js'));
  const saved = { ...process.env };
  Object.assign(process.env, hermeticEnv());
  try {
    delete require.cache[dispatcherPath];
    const { PRE_BASH_HOOKS, runPreBash } = require(dispatcherPath);
    const noVerify = PRE_BASH_HOOKS.find(h => h.id === 'pre:bash:block-no-verify');
    const autoTmux = PRE_BASH_HOOKS.find(h => h.id === 'pre:bash:auto-tmux-dev');
    const originalNoVerify = noVerify.run;
    const originalTmux = autoTmux.run;
    try {
      autoTmux.run = () => { throw new Error('tmux helper crashed'); };
      let result = runPreBash(VALID_BASH);
      assert.strictEqual(result.exitCode, 0, 'non-safety failure must not block');

      noVerify.run = () => { throw new Error('injected parser failure'); };
      result = runPreBash(VALID_BASH);
      assert.strictEqual(result.exitCode, 2, 'safety failure must block');
      assert.match(result.stderr, /BLOCKED/);
      assert.match(result.stderr, /injected parser failure/);
    } finally {
      noVerify.run = originalNoVerify;
      autoTmux.run = originalTmux;
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    delete require.cache[dispatcherPath];
  }
});

console.log('\nsafety hooks fail closed: plugin-hook-bootstrap.js');

function bootstrapRun(root, relPath, args, input) {
  return runNode(bootstrap, ['node', relPath, ...args], input, {
    CLAUDE_PLUGIN_ROOT: root,
    ECC_PLUGIN_ROOT: root
  });
}

check('bootstrap turns a crashing security hook (exit 1) into a block', () => {
  const root = makePluginRoot({
    'scripts/hooks/run-with-flags.js': "process.stderr.write('crashed\\n'); process.exit(1);\n"
  });
  const r = bootstrapRun(root, 'scripts/hooks/run-with-flags.js', [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'], VALID_BASH);
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /BLOCKED/);
});

check('bootstrap keeps exit 0 and exit 2 from a security hook as they are', () => {
  const ok = makePluginRoot({ 'scripts/hooks/run-with-flags.js': 'process.exit(0);\n' });
  const blocked = makePluginRoot({ 'scripts/hooks/run-with-flags.js': "process.stderr.write('no\\n'); process.exit(2);\n" });
  const args = [GATEGUARD_PS, GATEGUARD_SCRIPT, 'standard,strict'];
  assert.strictEqual(bootstrapRun(ok, 'scripts/hooks/run-with-flags.js', args, VALID_BASH).status, 0);
  assert.strictEqual(bootstrapRun(blocked, 'scripts/hooks/run-with-flags.js', args, VALID_BASH).status, 2);
});

check('bootstrap leaves a crashing non-security hook alone (exit 1 stays 1)', () => {
  const root = makePluginRoot({
    'scripts/hooks/run-with-flags.js': 'process.exit(1);\n'
  });
  const r = bootstrapRun(root, 'scripts/hooks/run-with-flags.js', ['pre:write:doc-file-warning', 'scripts/hooks/doc-file-warning.js', 'standard,strict'], VALID_BASH);
  assert.strictEqual(r.status, 1, `status ${r.status}; stderr: ${r.stderr}`);
});

check('safety exit policy: spawn error, timeout, signal and missing status all block', () => {
  const { resolveSafetyExit } = require('../../scripts/hooks/safety-hooks');
  assert.strictEqual(resolveSafetyExit({ status: 0 }).exitCode, 0);
  assert.strictEqual(resolveSafetyExit({ status: 2 }).exitCode, 2);
  for (const result of [
    { status: null, error: Object.assign(new Error('spawnSync node ETIMEDOUT'), { code: 'ETIMEDOUT' }) },
    { status: null, error: Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }) },
    { status: null, signal: 'SIGKILL' },
    { status: null },
    { status: 1 },
    { status: 137 }
  ]) {
    const verdict = resolveSafetyExit(result);
    assert.strictEqual(verdict.exitCode, 2, JSON.stringify(result));
    assert.match(verdict.stderr, /BLOCKED/);
  }
  // A real exit status that arrives together with a benign stdin pipe error is the child's own verdict.
  assert.strictEqual(
    resolveSafetyExit({ status: 2, error: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }) }).exitCode,
    2
  );
  assert.strictEqual(
    resolveSafetyExit({ status: 0, error: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }) }).exitCode,
    0
  );
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
