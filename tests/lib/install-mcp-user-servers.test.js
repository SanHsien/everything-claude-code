'use strict';

/**
 * Fork regression tests: installing MCP config must only change servers ECC
 * manages. A same-named server the user configured with their own command,
 * args or env is kept (with a warning), not replaced by ECC's definition.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { createInstallPlanFromRequest } = require('../../scripts/lib/install/runtime');
const { applyInstallPlan, previewInstallPlan } = require('../../scripts/lib/install/apply');
const { readInstallState } = require('../../scripts/lib/install-state');
const {
  buildDoctorReport,
  repairInstalledStates,
  uninstallInstalledStates,
} = require('../../scripts/lib/install-lifecycle');

const ECC_CHROME = { command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.10.1'] };
const ECC_CHROME_NEXT = { command: 'npx', args: ['-y', 'chrome-devtools-mcp@2.0.0'] };
const ECC_OTHER = { command: 'ecc-other', args: ['--stdio'] };
const USER_CHROME = { command: 'custom-local-command', args: ['--user-arg'], env: { USER_SETTING: 'keep' } };
const USER_SERVER = { command: 'user-mcp' };

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(t, { userConfig = null, eccServers = { 'chrome-devtools': ECC_CHROME, other: ECC_OTHER } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-mcp-user-servers-'));
  const previousDisabled = process.env.ECC_DISABLED_MCPS;
  delete process.env.ECC_DISABLED_MCPS;
  t.after(() => {
    if (previousDisabled === undefined) delete process.env.ECC_DISABLED_MCPS;
    else process.env.ECC_DISABLED_MCPS = previousDisabled;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const sourceRoot = path.join(root, 'source');
  const homeDir = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  const targetRoot = path.join(projectRoot, '.cursor');
  const configPath = path.join(targetRoot, 'mcp.json');
  const statePath = path.join(targetRoot, 'ecc-install-state.json');
  const json = (relativePath, value) => writeJson(path.join(sourceRoot, relativePath), value);
  json('package.json', { version: '1.0.0' });
  json('manifests/install-modules.json', {
    version: 1,
    modules: [{
      id: 'platform-configs', kind: 'platform', description: 'MCP ownership fixture',
      paths: ['mcp-configs'], targets: ['cursor'], dependencies: [],
      defaultInstall: false, cost: 'light', stability: 'stable',
    }],
  });
  json('manifests/install-profiles.json', {
    version: 1,
    profiles: { minimal: { description: 'MCP fixture', modules: ['platform-configs'] } },
  });
  const writeSource = servers => json('.mcp.json', { mcpServers: servers });
  writeSource(eccServers);
  fs.mkdirSync(path.join(sourceRoot, 'mcp-configs'), { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  if (userConfig) writeJson(configPath, userConfig);
  const options = { sourceRoot, homeDir, projectRoot, env: {} };
  const lifecycleOptions = { repoRoot: sourceRoot, homeDir, projectRoot, targets: ['cursor'], env: {} };
  const plan = () => createInstallPlanFromRequest({
    mode: 'manifest', target: 'cursor', profileId: null, moduleIds: ['platform-configs'],
    includeComponentIds: [], excludeComponentIds: [], hookConsent: 'declined',
  }, options);
  return {
    configPath,
    statePath,
    writeSource,
    preview: () => previewInstallPlan(plan()),
    install: () => applyInstallPlan(plan()),
    readConfig: () => JSON.parse(fs.readFileSync(configPath, 'utf8')),
    writeConfig: value => writeJson(configPath, value),
    recordedServers: () => {
      const operation = readInstallState(statePath).operations.find(entry => (
        entry.kind === 'merge-json' && entry.destinationPath === configPath
      ));
      return operation ? operation.mergePayload.mcpServers : null;
    },
    repair: () => repairInstalledStates(lifecycleOptions),
    doctor: () => buildDoctorReport(lifecycleOptions),
    uninstall: () => uninstallInstalledStates(lifecycleOptions),
  };
}

test('keeps a same-named user MCP server (command, args, env) and warns', t => {
  const fixture = createFixture(t, {
    userConfig: { mcpServers: { 'chrome-devtools': USER_CHROME, custom: USER_SERVER }, userKey: true },
  });
  const result = fixture.install();
  const config = fixture.readConfig();
  assert.deepEqual(config.mcpServers['chrome-devtools'], USER_CHROME, 'user definition must be untouched');
  assert.deepEqual(config.mcpServers.custom, USER_SERVER);
  assert.equal(config.userKey, true);
  assert.deepEqual(config.mcpServers.other, ECC_OTHER, 'non-conflicting bundled servers are still added');
  assert.ok(
    result.warnings.some(warning => warning.includes('chrome-devtools') && warning.includes(fixture.configPath)),
    `expected a warning naming the preserved server; got ${JSON.stringify(result.warnings)}`
  );
  assert.deepEqual(fixture.recordedServers(), { other: ECC_OTHER }, 'ledger must not claim the user server');
});

test('preview reports the preserved server without writing anything', t => {
  const fixture = createFixture(t, { userConfig: { mcpServers: { 'chrome-devtools': USER_CHROME } } });
  const before = fs.readFileSync(fixture.configPath, 'utf8');
  const preview = fixture.preview();
  assert.ok(preview.warnings.some(warning => warning.includes('chrome-devtools')));
  assert.equal(fs.readFileSync(fixture.configPath, 'utf8'), before);
});

test('uninstall and repair leave the preserved user server alone', t => {
  const fixture = createFixture(t, { userConfig: { mcpServers: { 'chrome-devtools': USER_CHROME } } });
  fixture.install();
  const repair = fixture.repair();
  assert.notEqual(repair.results[0].status, 'error', repair.results[0].error);
  assert.deepEqual(fixture.readConfig().mcpServers['chrome-devtools'], USER_CHROME);
  const uninstall = fixture.uninstall();
  assert.equal(uninstall.results[0].status, 'uninstalled', uninstall.results[0].error);
  assert.deepEqual(fixture.readConfig(), { mcpServers: { 'chrome-devtools': USER_CHROME } });
});

test('a fresh install and an identical existing definition produce no warning', t => {
  const fresh = createFixture(t);
  assert.deepEqual(fresh.install().warnings, []);
  assert.deepEqual(fresh.readConfig().mcpServers, { 'chrome-devtools': ECC_CHROME, other: ECC_OTHER });

  const same = createFixture(t, { userConfig: { mcpServers: { 'chrome-devtools': ECC_CHROME } } });
  assert.deepEqual(same.install().warnings, []);
});

test('reinstall updates a server ECC installed earlier and the user has not changed', t => {
  const fixture = createFixture(t);
  fixture.install();
  fixture.writeSource({ 'chrome-devtools': ECC_CHROME_NEXT, other: ECC_OTHER });
  const result = fixture.install();
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(fixture.readConfig().mcpServers['chrome-devtools'], ECC_CHROME_NEXT);
  assert.deepEqual(fixture.recordedServers()['chrome-devtools'], ECC_CHROME_NEXT);
});

test('reinstall keeps a server the user edited after ECC installed it', t => {
  const fixture = createFixture(t);
  fixture.install();
  const edited = { command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.10.1', '--user-flag'], env: { A: '1' } };
  const config = fixture.readConfig();
  config.mcpServers['chrome-devtools'] = edited;
  fixture.writeConfig(config);
  fixture.writeSource({ 'chrome-devtools': ECC_CHROME_NEXT, other: ECC_OTHER });
  const result = fixture.install();
  assert.deepEqual(fixture.readConfig().mcpServers['chrome-devtools'], edited);
  assert.ok(result.warnings.some(warning => warning.includes('chrome-devtools')));
  assert.equal(fixture.recordedServers()['chrome-devtools'], undefined);
});

test('when every bundled server collides nothing is claimed and the file is unchanged', t => {
  const fixture = createFixture(t, {
    eccServers: { 'chrome-devtools': ECC_CHROME },
    userConfig: { mcpServers: { 'chrome-devtools': USER_CHROME } },
  });
  const before = fs.readFileSync(fixture.configPath, 'utf8');
  const result = fixture.install();
  assert.equal(fs.readFileSync(fixture.configPath, 'utf8'), before);
  assert.ok(result.warnings.some(warning => warning.includes('chrome-devtools')));
  assert.equal(fixture.recordedServers(), null);
});
