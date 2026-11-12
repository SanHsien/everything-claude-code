/**
 * Branch merging regressions for block-no-verify (review round 4).
 *
 * Each conditional assignment used to double the shell states of the command
 * stream, so about eight of them exhausted the analysis budget and blocked
 * ordinary commands. States that reach the same point are now merged, and a
 * variable that may hold several values is checked for each of them.
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
  assert.strictEqual(r.exitCode, 2, `expected exit 2 for ${JSON.stringify(command).slice(0, 160)}, got ${r.exitCode}`);
  assert.ok(String(r.stderr).includes('BLOCKED'), 'stderr should contain BLOCKED');
}

function allowedWithin(command, limitMs) {
  const started = Date.now();
  const r = run(command);
  const elapsed = Date.now() - started;
  assert.strictEqual(r.exitCode, 0, `expected exit 0 for ${JSON.stringify(command).slice(0, 160)}, got ${r.exitCode}: ${r.stderr}`);
  assert.ok(elapsed < limitMs, `took ${elapsed} ms, limit ${limitMs} ms`);
}

function conditionalAssignments(count, build) {
  const parts = [];
  for (let i = 1; i <= count; i++) parts.push(build(i));
  return parts;
}

console.log('\nmany conditional assignments no longer exhaust the budget');

test('8 `if c; then aN=1; fi` then git status is allowed quickly', () => {
  const parts = conditionalAssignments(8, i => `if c; then a${i}=1; fi`);
  allowedWithin([...parts, 'git status'].join('; '), 1000);
});

test('8 `[ -f fN ] && AN=1` then npm test is allowed quickly', () => {
  const parts = conditionalAssignments(8, i => `[ -f f${i} ] && A${i}=1`);
  allowedWithin([...parts, 'npm test'].join('; '), 1000);
});

test('8 default-value assignments then npm test is allowed quickly', () => {
  const parts = conditionalAssignments(8, i => `[ -z "$X${i}" ] && X${i}=d`);
  allowedWithin([...parts, 'npm test'].join('; '), 1000);
});

test('30 conditional assignments then npm test is allowed quickly', () => {
  const parts = conditionalAssignments(30, i => `[ -f f${i} ] && A${i}=1`);
  allowedWithin([...parts, 'npm test'].join('; '), 1000);
});

test('30 `if c; then aN=1; fi` then git status is allowed quickly', () => {
  const parts = conditionalAssignments(30, i => `if c; then a${i}=1; fi`);
  allowedWithin([...parts, 'git status'].join('; '), 1000);
});

console.log('\nmerged values are still checked for each possibility');

test('blocks $g commit --no-verify when the branches set g to git or echo', () => {
  mustBlock('if c; then g=git; else g=echo; fi; $g commit --no-verify');
});

test('blocks $g when only one branch sets it to git', () => {
  mustBlock('if c; then g=git; fi; $g commit --no-verify');
});

test('blocks git commit when one branch exports HUSKY=0', () => {
  mustBlock('if c; then export HUSKY=0; fi; git commit -m x');
});

test('blocks git commit when one branch exports HUSKY=0 via an else arm', () => {
  mustBlock('if c; then :; else export HUSKY=0; fi; git commit -m x');
});

test('allows git commit when no branch changes HUSKY', () => {
  allowedWithin('if c; then x=1; fi; git commit -m x', 1000);
});

test('blocks a later assignment when one branch made g readonly (sticky value)', () => {
  mustBlock('if c; then readonly g=echo; fi; g=git; $g commit --no-verify');
});

test('blocks a git commit after a readonly-branch join that later assigns git', () => {
  mustBlock('c && readonly g=echo; if c; then g=git; fi; $g commit --no-verify');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
