'use strict';

/**
 * Fork regression test: validating every profile x target projection must load
 * (and identity-verify) the context registry once, not once per projection.
 *
 * validate() used to call compileContextProfile() for each of 2 profiles x 17
 * targets; every call re-read all ~314 skill sources through the safe reader
 * (open + lstat ancestor chain per file). On hosts where file-system calls are
 * slow (Windows with real-time scanning) that alone exceeded the CI test's
 * 60-second budget. This pins the property, not the wall-clock time.
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const registryModulePath = require.resolve('../../scripts/lib/context-pack-registry');
const profilesModulePath = require.resolve('../../scripts/lib/context-profiles');
const validatorModulePath = require.resolve('../../scripts/ci/validate-context-profiles');

function withCountedRegistryLoads(fn) {
  const registryModule = require(registryModulePath);
  const original = registryModule.loadContextRegistry;
  let loads = 0;
  registryModule.loadContextRegistry = (...args) => {
    loads += 1;
    return original(...args);
  };
  delete require.cache[profilesModulePath];
  delete require.cache[validatorModulePath];
  try {
    return fn(() => loads);
  } finally {
    registryModule.loadContextRegistry = original;
    delete require.cache[profilesModulePath];
    delete require.cache[validatorModulePath];
  }
}

const tests = [
  ['validate() loads the registry once for all profile/target projections', () => {
    withCountedRegistryLoads(getLoads => {
      const { validate } = require(validatorModulePath);
      const result = validate(ROOT);
      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.projectionCount, result.profileCount * result.targetCount);
      assert.strictEqual(
        getLoads(),
        1,
        `registry was loaded ${getLoads()} times for ${result.projectionCount} projections`
      );
    });
  }],
  ['a shared-registry plan is byte-identical to a standalone compile of the same pair', () => {
    const { compileContextProfile, compileContextProfileMatrix } = require(profilesModulePath);
    const { plans, registry } = compileContextProfileMatrix({
      repoRoot: ROOT, profileIds: ['lean@1'], targets: ['codex'],
    });
    assert.strictEqual(plans.length, 1);
    assert.ok(registry.registryDigest);
    const standalone = compileContextProfile({ repoRoot: ROOT, profileId: 'lean@1', target: 'codex' });
    assert.strictEqual(plans[0].plan.planDigest, standalone.planDigest);
  }],
  ['the matrix compiler rejects an unknown target and an unknown profile', () => {
    const { compileContextProfileMatrix } = require(profilesModulePath);
    assert.strictEqual(typeof compileContextProfileMatrix, 'function');
    assert.throws(() => compileContextProfileMatrix({ repoRoot: ROOT, profileIds: ['lean@1'], targets: ['nope'] }), /target/i);
    assert.throws(() => compileContextProfileMatrix({ repoRoot: ROOT, profileIds: ['missing@9'], targets: ['codex'] }), /profile/i);
  }],
];

let passed = 0;
for (const [name, test] of tests) {
  try { test(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); }
}
console.log(`Passed: ${passed}\nFailed: ${tests.length - passed}`);
process.exitCode = tests.length - passed > 0 ? 1 : 0;
