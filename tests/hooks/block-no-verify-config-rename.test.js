/**
 * git config rename-section into a hook-redirecting section (review round 3, C).
 *
 * Renaming a section moves its keys: `set foo.hooksPath X` followed by
 * `rename-section foo core` makes core.hooksPath = X. Both the subcommand and
 * the old --rename-section syntax are checked by the target section name, which
 * git compares case-insensitively.
 */

'use strict';

const assert = require('assert');
const hook = require('../../scripts/hooks/block-no-verify');

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

function run(command) {
  return hook.run(JSON.stringify({ tool_input: { command } }));
}

function mustBlock(command) {
  const r = run(command);
  assert.strictEqual(r.exitCode, 2, `expected exit 2 for ${JSON.stringify(command)}, got ${r.exitCode}`);
  assert.ok(String(r.stderr).includes('BLOCKED'), 'stderr should contain BLOCKED');
}

function mustAllow(command) {
  const r = run(command);
  assert.strictEqual(r.exitCode, 0, `expected exit 0 for ${JSON.stringify(command)}, got ${r.exitCode}: ${r.stderr}`);
}

console.log('\nrename-section into a hook-redirecting section is blocked');

test('blocks rename-section foo core after a set (subcommand syntax, the reported bypass)', () => {
  mustBlock('git config set foo.hooksPath /dev/null; git config rename-section foo core');
});

test('blocks --rename-section foo core (old syntax)', () => {
  mustBlock('git config --rename-section foo core');
});

test('blocks rename-section into include', () => {
  mustBlock('git config rename-section foo include');
});

test('blocks rename-section into includeIf.<cond>', () => {
  mustBlock('git config rename-section foo includeIf.gitdir:/x');
});

test('blocks rename-section into CORE (case-insensitive target)', () => {
  mustBlock('git config rename-section foo CORE');
});

test('blocks --rename-section into Include (old syntax, case-insensitive)', () => {
  mustBlock('git config --rename-section foo Include');
});

console.log('\nrename-section between ordinary sections stays allowed');

test('allows rename-section foo bar', () => {
  mustAllow('git config rename-section foo bar');
});

test('allows --rename-section foo bar (old syntax)', () => {
  mustAllow('git config --rename-section foo bar');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
