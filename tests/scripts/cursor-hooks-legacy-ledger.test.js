/**
 * Legacy-ledger upgrade paths for ECC's Cursor hooks.json entries (F5 follow-up).
 *
 * A ledger written before per-entry records (`eccEntries`) has no proof of which
 * entries ECC wrote. Until the ledger is rewritten, an entry is claimed only when
 * its event and full content equal an entry of the current ECC source, and each
 * source entry claims at most one existing entry. Three paths are driven through
 * the real CLIs: uninstall first, reinstall first, and repair first.
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
const repairScript = path.join(repoRoot, 'scripts', 'repair.js');

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

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function countEntries(hooks) {
  return Object.values(hooks.hooks || {}).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
}

const SOURCE = JSON.parse(fs.readFileSync(path.join(repoRoot, '.cursor', 'hooks.json'), 'utf8'));
const SOURCE_COUNT = countEntries(SOURCE);
const SOURCE_CANON = new Set();
for (const [event, entries] of Object.entries(SOURCE.hooks || {})) {
  for (const entry of entries) SOURCE_CANON.add(`${event}\u0000${canonical(entry)}`);
}

const USER_SAME_COMMAND_OTHER_EVENT = { command: 'node .cursor/hooks/session-start.js', event: 'stop', description: 'USER OWNED' };
const USER_SAME_COMMAND_OTHER_FIELDS = { command: 'node .cursor/hooks/stop.js', matcher: 'user-only', timeout: 99 };
const USER_ENTRIES = [USER_SAME_COMMAND_OTHER_EVENT, USER_SAME_COMMAND_OTHER_FIELDS];

function withCase(fn) {
  const projectDir = tempDir('cursor-legacy-project-');
  const homeDir = tempDir('cursor-legacy-home-');
  try {
    fn(projectDir, homeDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
}

function installCursor(projectDir, homeDir) {
  const result = cli(installScript, ['--target', 'cursor', '--modules', 'hooks-runtime', '--enable-hooks'], projectDir, homeDir);
  assert.strictEqual(result.code, 0, `install failed: ${result.stderr}`);
}

// A fresh install with user entries added, then the ledger's per-entry records
// removed to make it look like one written before eccEntries existed.
function legacyProject(projectDir, homeDir) {
  installCursor(projectDir, homeDir);
  const hooks = readHooks(projectDir);
  hooks.hooks.stop = [...(hooks.hooks.stop || []), ...USER_ENTRIES];
  writeHooks(projectDir, hooks);
  const state = JSON.parse(fs.readFileSync(statePath(projectDir), 'utf8'));
  for (const operation of state.operations) {
    if (operation.destinationPath && operation.destinationPath.endsWith('hooks.json')) delete operation.eccEntries;
  }
  fs.writeFileSync(statePath(projectDir), `${JSON.stringify(state, null, 2)}\n`);
}

function assertOnlyUserEntries(hooks) {
  const all = Object.values(hooks.hooks || {}).flat();
  assert.strictEqual(all.length, USER_ENTRIES.length, `expected only user entries, got ${all.length}: ${JSON.stringify(all)}`);
  for (const [event, entries] of Object.entries(hooks.hooks || {})) {
    for (const entry of entries) {
      assert.ok(!SOURCE_CANON.has(`${event}\u0000${canonical(entry)}`), `ECC entry left behind under ${event}`);
    }
  }
  assert.strictEqual(all.filter(e => e.description === 'USER OWNED').length, 1, 'user entry (other event) kept once');
  assert.strictEqual(all.filter(e => e.matcher === 'user-only').length, 1, 'user entry (other fields) kept once');
}

function assertUserAndEccOnce(hooks) {
  const expected = SOURCE_COUNT + USER_ENTRIES.length;
  assert.strictEqual(countEntries(hooks), expected, `expected ${expected} entries, got ${countEntries(hooks)} (duplicates or orphans)`);
  const all = Object.values(hooks.hooks || {}).flat();
  assert.strictEqual(all.filter(e => e.description === 'USER OWNED').length, 1, 'user entry (other event) kept once');
  assert.strictEqual(all.filter(e => e.matcher === 'user-only').length, 1, 'user entry (other fields) kept once');
}

console.log('\nlegacy ledger, path 1: uninstall first');

test('uninstall removes exactly the ECC entries and keeps the user entries', () => {
  withCase((projectDir, homeDir) => {
    legacyProject(projectDir, homeDir);
    const result = cli(uninstallScript, ['--target', 'cursor'], projectDir, homeDir);
    assert.strictEqual(result.code, 0, `uninstall failed: ${result.stderr}`);
    assertOnlyUserEntries(readHooks(projectDir));
  });
});

console.log('\nlegacy ledger, path 2: reinstall first');

test('reinstall does not duplicate ECC entries, and a later uninstall leaves only user entries', () => {
  withCase((projectDir, homeDir) => {
    legacyProject(projectDir, homeDir);
    installCursor(projectDir, homeDir);
    assertUserAndEccOnce(readHooks(projectDir));
    const result = cli(uninstallScript, ['--target', 'cursor'], projectDir, homeDir);
    assert.strictEqual(result.code, 0, `uninstall failed: ${result.stderr}`);
    assertOnlyUserEntries(readHooks(projectDir));
  });
});

console.log('\nlegacy ledger, path 3: repair first');

test('repair does not duplicate or adopt user entries, and a later uninstall leaves only user entries', () => {
  withCase((projectDir, homeDir) => {
    legacyProject(projectDir, homeDir);
    const repaired = cli(repairScript, ['--target', 'cursor'], projectDir, homeDir);
    assert.strictEqual(repaired.code, 0, `repair failed: ${repaired.stderr}`);
    assertUserAndEccOnce(readHooks(projectDir));
    const result = cli(uninstallScript, ['--target', 'cursor'], projectDir, homeDir);
    assert.strictEqual(result.code, 0, `uninstall failed: ${result.stderr}`);
    assertOnlyUserEntries(readHooks(projectDir));
  });
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
