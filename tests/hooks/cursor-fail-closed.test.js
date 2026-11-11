/**
 * Fork regression tests: the Cursor beforeShellExecution dispatcher must fail
 * closed. Cursor denies a command on exit code 2; any other failure of the
 * guard (spawn error, timeout, signal, crash, missing script) used to be logged
 * and the command was allowed.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cursor-failclosed-'));
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

const PAYLOAD = JSON.stringify({ command: 'echo hello', hook_event_name: 'beforeShellExecution' });

// A project-style install: <root>/.cursor/hooks/*.js next to <root>/scripts/{hooks,lib}.
function createInstall(blockNoVerifySource) {
  const root = fs.mkdtempSync(path.join(sandbox, 'install-'));
  fs.mkdirSync(path.join(root, '.cursor', 'hooks'), { recursive: true });
  for (const file of ['adapter.js', 'before-shell-execution.js']) {
    fs.copyFileSync(path.join(repoRoot, '.cursor', 'hooks', file), path.join(root, '.cursor', 'hooks', file));
  }
  fs.cpSync(path.join(repoRoot, 'scripts', 'lib'), path.join(root, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts', 'hooks'), { recursive: true });
  if (blockNoVerifySource !== null) {
    fs.writeFileSync(path.join(root, 'scripts', 'hooks', 'block-no-verify.js'), blockNoVerifySource);
  }
  return root;
}

function run(root, env = {}, input = PAYLOAD) {
  const home = path.join(sandbox, 'home');
  fs.mkdirSync(home, { recursive: true });
  const base = {
    ...process.env, HOME: home, USERPROFILE: home, TEMP: home, TMP: home, TMPDIR: home,
    ECC_HOOK_PROFILE: 'standard',
  };
  for (const key of ['ECC_DISABLED_HOOKS', 'ECC_HOOKS_ENABLED', 'ECC_HOOK_CONFIG', 'ECC_CURSOR_HOOK_TIMEOUT_MS']) delete base[key];
  return spawnSync(process.execPath, [path.join(root, '.cursor', 'hooks', 'before-shell-execution.js')], {
    input, encoding: 'utf8', timeout: 60000, cwd: root, env: { ...base, ...env },
  });
}

console.log('\nCursor beforeShellExecution fails closed');

check('a guard that crashes (exit 1) denies the command', () => {
  const r = run(createInstall("process.stderr.write('boom\\n'); process.exit(1);\n"));
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stderr, /block-no-verify/);
});

check('a guard script that is missing denies the command', () => {
  const r = run(createInstall(null));
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a guard that times out denies the command', () => {
  const r = run(createInstall('setInterval(() => {}, 1000);\n'), { ECC_CURSOR_HOOK_TIMEOUT_MS: '1500' });
  assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
});

check('a healthy guard that allows keeps allowing and echoes the input', () => {
  const r = run(createInstall('process.exit(0);\n'));
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
  assert.strictEqual(r.stdout, PAYLOAD);
});

check('a guard that denies (exit 2) still denies', () => {
  const r = run(createInstall("process.stderr.write('no\\n'); process.exit(2);\n"));
  assert.strictEqual(r.status, 2);
});

check('a broken guard that the user disabled does not deny', () => {
  const r = run(createInstall('process.exit(1);\n'), {
    ECC_DISABLED_HOOKS: 'pre:bash:block-no-verify,pre:bash:dev-server-block',
  });
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

console.log('\nECC_CURSOR_HOOK_TIMEOUT_MS is bounded');

// A healthy guard must keep working whatever the override says; a too-small
// value would otherwise time every command out and (fail-closed) block it.
for (const [label, value] of [['1 (below the minimum)', '1'], ['999 (below the minimum)', '999'], ['0', '0'], ['-5', '-5'], ['abc', 'abc'], ['1.5', '1.5'], ['60001 (above the maximum)', '60001'], ['99999999999', '99999999999']]) {
  check(`override ${label} falls back to the default with a warning and does not block a healthy guard`, () => {
    const r = run(createInstall('process.exit(0);\n'), { ECC_CURSOR_HOOK_TIMEOUT_MS: value });
    assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
    assert.match(r.stderr, /ECC_CURSOR_HOOK_TIMEOUT_MS/);
    assert.match(r.stderr, /15000/);
  });
}

for (const value of ['1000', '60000']) {
  check(`override ${value} (the bounds themselves) is accepted without a warning`, () => {
    const r = run(createInstall('process.exit(0);\n'), { ECC_CURSOR_HOOK_TIMEOUT_MS: value });
    assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /ECC_CURSOR_HOOK_TIMEOUT_MS/);
  });
}

console.log('\nunusable stdin fails closed while a guard is enabled');

for (const [label, input] of [['empty', ''], ['not JSON', '{ not json'], ['JSON null', 'null'], ['a JSON array', '[]']]) {
  check(`${label} stdin denies the command`, () => {
    const r = run(createInstall('process.exit(0);\n'), {}, input);
    assert.strictEqual(r.status, 2, `status ${r.status}; stderr: ${r.stderr}`);
    assert.match(r.stderr, /BLOCKED/);
  });
}

check('unusable stdin is not denied once the guards are disabled', () => {
  const r = run(createInstall('process.exit(0);\n'), {
    ECC_DISABLED_HOOKS: 'pre:bash:block-no-verify,pre:bash:dev-server-block',
  }, '{ not json');
  assert.strictEqual(r.status, 0, `status ${r.status}; stderr: ${r.stderr}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
