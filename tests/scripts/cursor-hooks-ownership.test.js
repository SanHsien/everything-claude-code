/**
 * End-to-end ownership tests for ECC's Cursor hooks.json entries (F5).
 *
 * ECC installs and removes its entries through the real install and uninstall
 * CLIs in a temporary project. A user entry that happens to use the same
 * `command` as an ECC entry must survive uninstall and reinstall, because
 * ownership is per entry (event plus full content), not per command string.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '..', '..');
const installScript = path.join(repoRoot, 'scripts', 'install-apply.js');
const uninstallScript = path.join(repoRoot, 'scripts', 'uninstall.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cli(script, args, cwd, homeDir) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  });
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function hooksPath(projectDir) {
  return path.join(projectDir, '.cursor', 'hooks.json');
}

function statePath(projectDir) {
  return path.join(projectDir, '.cursor', 'ecc-install-state.json');
}

function readHooks(projectDir) {
  return JSON.parse(fs.readFileSync(hooksPath(projectDir), 'utf8'));
}

function writeHooks(projectDir, value) {
  fs.writeFileSync(hooksPath(projectDir), `${JSON.stringify(value, null, 2)}\n`);
}

function installCursor(projectDir, homeDir) {
  const result = cli(installScript, ['--target', 'cursor', '--modules', 'hooks-runtime', '--enable-hooks'], projectDir, homeDir);
  assert.strictEqual(result.code, 0, `install failed: ${result.stderr}`);
}

function uninstallCursor(projectDir, homeDir) {
  const result = cli(uninstallScript, ['--target', 'cursor'], projectDir, homeDir);
  assert.strictEqual(result.code, 0, `uninstall failed: ${result.stderr}`);
}

// Entries from a fresh ECC install, plus a user entry with the same command
// under a different event (the first pair) or with different fields.
function withUserEntry(projectDir, event, entry) {
  const hooks = readHooks(projectDir);
  hooks.hooks[event] = [...(hooks.hooks[event] || []), entry];
  writeHooks(projectDir, hooks);
}

function withCase(fn) {
  const projectDir = tempDir('cursor-ownership-project-');
  const homeDir = tempDir('cursor-ownership-home-');
  try {
    fn(projectDir, homeDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
}

const SESSION_START = 'node .cursor/hooks/session-start.js';
const STOP = 'node .cursor/hooks/stop.js';
const USER_SAME_COMMAND_OTHER_EVENT = { command: SESSION_START, event: 'stop', description: 'USER OWNED' };
const USER_SAME_COMMAND_OTHER_FIELDS = { command: STOP, matcher: 'user-only', timeout: 99 };

console.log('\nuninstall removes only ECC-owned entries');

test('a user entry with an ECC command under another event survives uninstall', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    withUserEntry(projectDir, 'stop', USER_SAME_COMMAND_OTHER_EVENT);
    uninstallCursor(projectDir, homeDir);
    assert.ok(fs.existsSync(hooksPath(projectDir)), 'hooks.json must not be deleted');
    const hooks = readHooks(projectDir);
    assert.deepStrictEqual(hooks.hooks.stop.filter(entry => entry.description === 'USER OWNED'), [USER_SAME_COMMAND_OTHER_EVENT]);
    assert.strictEqual(hooks.hooks.sessionStart, undefined, 'ECC sessionStart entry should be removed');
  });
});

test('a user entry with an ECC command and different fields survives; the ECC entry is removed', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    withUserEntry(projectDir, 'stop', USER_SAME_COMMAND_OTHER_FIELDS);
    uninstallCursor(projectDir, homeDir);
    const hooks = readHooks(projectDir);
    assert.deepStrictEqual(hooks.hooks.stop, [USER_SAME_COMMAND_OTHER_FIELDS]);
  });
});

test('when only a user entry is left, hooks.json is kept with that entry', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    writeHooks(projectDir, { version: 1, hooks: { stop: [USER_SAME_COMMAND_OTHER_EVENT] } });
    uninstallCursor(projectDir, homeDir);
    assert.ok(fs.existsSync(hooksPath(projectDir)), 'hooks.json with the user entry must not be deleted');
    assert.deepStrictEqual(readHooks(projectDir).hooks.stop, [USER_SAME_COMMAND_OTHER_EVENT]);
  });
});

console.log('\nreinstall keeps user entries and does not duplicate ECC entries');

test('reinstall keeps a user entry that shares an ECC command', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    withUserEntry(projectDir, 'stop', USER_SAME_COMMAND_OTHER_EVENT);
    installCursor(projectDir, homeDir);
    const hooks = readHooks(projectDir);
    const userEntries = hooks.hooks.stop.filter(entry => entry.description === 'USER OWNED');
    assert.strictEqual(userEntries.length, 1, 'user entry must be kept exactly once');
  });
});

test('reinstall does not duplicate ECC entries recorded in the ledger', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    const first = readHooks(projectDir).hooks.stop.length;
    installCursor(projectDir, homeDir);
    assert.strictEqual(readHooks(projectDir).hooks.stop.length, first);
  });
});

console.log('\nlegacy ledger without recorded entries keeps everything');

test('a ledger without recorded ECC entries retains entries rather than guessing ownership', () => {
  withCase((projectDir, homeDir) => {
    installCursor(projectDir, homeDir);
    withUserEntry(projectDir, 'stop', USER_SAME_COMMAND_OTHER_FIELDS);
    const state = JSON.parse(fs.readFileSync(statePath(projectDir), 'utf8'));
    for (const operation of state.operations) {
      if (operation.destinationPath && operation.destinationPath.endsWith('hooks.json')) delete operation.eccEntries;
    }
    fs.writeFileSync(statePath(projectDir), `${JSON.stringify(state, null, 2)}\n`);
    uninstallCursor(projectDir, homeDir);
    assert.ok(fs.existsSync(hooksPath(projectDir)));
    const hooks = readHooks(projectDir);
    assert.ok(hooks.hooks.stop.some(entry => entry.matcher === 'user-only'), 'user entry must be kept');
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
