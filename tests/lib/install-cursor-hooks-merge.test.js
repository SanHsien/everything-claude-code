'use strict';

/**
 * Fork regression tests: reinstall, repair and uninstall of Cursor's shared
 * .cursor/hooks.json must keep hooks the user added; only ECC's own entries
 * (commands that run a script from the ECC-installed .cursor/hooks/ directory)
 * are managed.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { createInstallPlanFromRequest } = require('../../scripts/lib/install/runtime');
const { applyInstallPlan } = require('../../scripts/lib/install/apply');
const {
  repairInstalledStates,
  uninstallInstalledStates,
} = require('../../scripts/lib/install-lifecycle');

const ECC_SHELL = {
  command: 'node .cursor/hooks/before-shell-execution.js',
  event: 'beforeShellExecution',
  description: 'ECC shell guard',
};
const ECC_SHELL_NEXT = { ...ECC_SHELL, command: 'node .cursor/hooks/before-shell-execution-v2.js' };
const ECC_START = {
  command: 'node .cursor/hooks/session-start.js',
  event: 'sessionStart',
  description: 'ECC session start',
};
const USER_SHELL = { command: 'my-shell-check --strict', event: 'beforeShellExecution' };
const USER_STOP = { command: 'python tools/on-stop.py', event: 'stop' };

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function eccHooks(shellEntry = ECC_SHELL) {
  return { version: 1, hooks: { sessionStart: [ECC_START], beforeShellExecution: [shellEntry] } };
}

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-cursor-hooks-merge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, 'source');
  const homeDir = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  const targetRoot = path.join(projectRoot, '.cursor');
  const hooksPath = path.join(targetRoot, 'hooks.json');
  const json = (relativePath, value) => writeJson(path.join(sourceRoot, relativePath), value);
  json('package.json', { version: '1.0.0' });
  json('manifests/install-modules.json', {
    version: 1,
    modules: [{
      id: 'hooks-runtime', kind: 'hooks', description: 'Cursor hooks fixture',
      paths: ['hooks'], targets: ['cursor'], dependencies: [],
      defaultInstall: false, cost: 'light', stability: 'stable',
    }],
  });
  json('manifests/install-profiles.json', {
    version: 1,
    profiles: { minimal: { description: 'hooks fixture', modules: ['hooks-runtime'] } },
  });
  json('.cursor/hooks.json', eccHooks());
  for (const script of ['session-start.js', 'before-shell-execution.js', 'before-shell-execution-v2.js']) {
    fs.mkdirSync(path.join(sourceRoot, '.cursor', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, '.cursor', 'hooks', script), '// hook\n');
  }
  fs.mkdirSync(path.join(sourceRoot, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(sourceRoot, 'hooks', 'hooks.json'), '{"hooks":{}}\n');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  const options = { sourceRoot, homeDir, projectRoot, env: {} };
  const lifecycleOptions = { repoRoot: sourceRoot, homeDir, projectRoot, targets: ['cursor'], env: {} };
  const plan = () => createInstallPlanFromRequest({
    mode: 'manifest', target: 'cursor', profileId: null, moduleIds: ['hooks-runtime'],
    includeComponentIds: [], excludeComponentIds: [], hookConsent: 'enabled',
  }, options);
  return {
    sourceRoot,
    hooksPath,
    writeSource: value => json('.cursor/hooks.json', value),
    install: () => applyInstallPlan(plan()),
    read: () => JSON.parse(fs.readFileSync(hooksPath, 'utf8')),
    write: value => writeJson(hooksPath, value),
    repair: () => repairInstalledStates(lifecycleOptions),
    uninstall: () => uninstallInstalledStates(lifecycleOptions),
  };
}

function withUserHooks(config) {
  const next = JSON.parse(JSON.stringify(config));
  next.hooks.beforeShellExecution.push(USER_SHELL);
  next.hooks.stop = [USER_STOP];
  next.userKey = 'keep';
  return next;
}

test('first install writes ECC hooks.json unchanged', t => {
  const fixture = createFixture(t);
  fixture.install();
  assert.deepEqual(fixture.read(), eccHooks());
});

test('reinstall keeps hooks the user added to the managed hooks.json', t => {
  const fixture = createFixture(t);
  fixture.install();
  fixture.write(withUserHooks(fixture.read()));
  fixture.install();
  const config = fixture.read();
  assert.deepEqual(config.hooks.beforeShellExecution, [ECC_SHELL, USER_SHELL], 'ECC once, user kept');
  assert.deepEqual(config.hooks.stop, [USER_STOP]);
  assert.deepEqual(config.hooks.sessionStart, [ECC_START]);
  assert.equal(config.userKey, 'keep');
});

test('reinstall replaces ECC entries with the new definition without duplicating', t => {
  const fixture = createFixture(t);
  fixture.install();
  fixture.write(withUserHooks(fixture.read()));
  fixture.writeSource(eccHooks(ECC_SHELL_NEXT));
  fixture.install();
  fixture.install();
  assert.deepEqual(fixture.read().hooks.beforeShellExecution, [ECC_SHELL_NEXT, USER_SHELL]);
});

test('repair restores ECC entries and still keeps user hooks', t => {
  const fixture = createFixture(t);
  fixture.install();
  const edited = withUserHooks(fixture.read());
  delete edited.hooks.sessionStart;
  fixture.write(edited);
  const report = repairResult(fixture.repair());
  assert.notEqual(report.status, 'error', report.error);
  const config = fixture.read();
  assert.deepEqual(config.hooks.sessionStart, [ECC_START]);
  assert.deepEqual(config.hooks.beforeShellExecution, [ECC_SHELL, USER_SHELL]);
  assert.deepEqual(config.hooks.stop, [USER_STOP]);
});

test('uninstall removes ECC hook entries but keeps the user hooks', t => {
  const fixture = createFixture(t);
  fixture.install();
  fixture.write(withUserHooks(fixture.read()));
  fixture.install(); // merged state is what the ledger now records
  const report = repairResult(fixture.uninstall());
  assert.equal(report.status, 'uninstalled', report.error);
  assert.deepEqual(fixture.read(), {
    version: 1,
    userKey: 'keep',
    hooks: { beforeShellExecution: [USER_SHELL], stop: [USER_STOP] },
  });
});

test('uninstall still deletes hooks.json when only ECC entries are left', t => {
  const fixture = createFixture(t);
  fixture.install();
  const report = repairResult(fixture.uninstall());
  assert.equal(report.status, 'uninstalled', report.error);
  assert.equal(fs.existsSync(fixture.hooksPath), false);
});

test('a hooks.json the installer cannot parse is left untouched and reported', t => {
  const fixture = createFixture(t);
  fixture.install();
  fs.writeFileSync(fixture.hooksPath, '{ not json');
  assert.throws(() => fixture.install(), /hooks\.json/);
  assert.equal(fs.readFileSync(fixture.hooksPath, 'utf8'), '{ not json');
});

test('a user script that lives in the ECC hooks directory is never treated as an ECC entry', t => {
  const fixture = createFixture(t);
  fixture.install();
  const userScript = { command: 'node .cursor/hooks/my-own-script.js', event: 'stop' };
  const config = fixture.read();
  config.hooks.stop = [userScript];
  fixture.write(config);
  fixture.install();
  assert.deepEqual(fixture.read().hooks.stop, [userScript], 'reinstall keeps it');
  const edited = fixture.read();
  delete edited.hooks.sessionStart;
  fixture.write(edited);
  repairResult(fixture.repair());
  assert.deepEqual(fixture.read().hooks.stop, [userScript], 'repair keeps it');
  assert.equal(repairResult(fixture.uninstall()).status, 'uninstalled');
  assert.deepEqual(fixture.read(), { version: 1, hooks: { stop: [userScript] } }, 'uninstall keeps the file and the entry');
});

test('uninstall leaves a hooks.json without ECC entries untouched instead of deleting it', t => {
  const fixture = createFixture(t);
  fixture.install();
  fixture.write({ version: 1, hooks: {} });
  repairResult(fixture.uninstall());
  assert.deepEqual(fixture.read(), { version: 1, hooks: {} });
});

test('an entry written by an older ECC version (script recorded in the ledger) is removed on reinstall', t => {
  const fixture = createFixture(t);
  const legacy = { command: 'node .cursor/hooks/legacy-guard.js', event: 'preCompact', description: 'old ECC guard' };
  const withLegacy = eccHooks();
  withLegacy.hooks.preCompact = [legacy];
  fixture.writeSource(withLegacy);
  fs.writeFileSync(path.join(fixture.sourceRoot, '.cursor', 'hooks', 'legacy-guard.js'), '// old');
  fixture.install();
  assert.deepEqual(fixture.read().hooks.preCompact, [legacy]);
  // The new ECC version dropped that hook and its script.
  fixture.writeSource(eccHooks());
  fs.rmSync(path.join(fixture.sourceRoot, '.cursor', 'hooks', 'legacy-guard.js'));
  fixture.install();
  assert.equal(fixture.read().hooks.preCompact, undefined, 'the stale ECC entry is gone');
  assert.deepEqual(fixture.read().hooks.sessionStart, [ECC_START]);
});

function repairResult(report) {
  assert.equal(report.results.length, 1);
  return report.results[0];
}
