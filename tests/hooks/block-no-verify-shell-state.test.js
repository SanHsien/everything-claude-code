/**
 * Shell-state regressions for block-no-verify (review round 3).
 *
 * A: a variable reference split by quotes ($''g, $'' followed by a name) must be
 *    read as the variable, not skipped by a pre-scan of the raw text.
 * B: shell state must not be copied whole for every branch; long, ordinary
 *    input with many tracked names must finish quickly and be allowed.
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

function mustAllow(command) {
  const r = run(command);
  assert.strictEqual(r.exitCode, 0, `expected exit 0 for ${JSON.stringify(command).slice(0, 160)}, got ${r.exitCode}: ${r.stderr}`);
}

function allowedWithin(command, limitMs) {
  const started = Date.now();
  mustAllow(command);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < limitMs, `took ${elapsed} ms, limit ${limitMs} ms`);
}

console.log('\nA: quote-split variable references are read as variables');

test('blocks export g=git; bash -c with $\'\'g split reference', () => {
  mustBlock("export g=git; bash -c '$''g commit --no-verify'");
});

test('blocks the $\'\' plus double-quoted split form', () => {
  mustBlock("export g=git; bash -c '$'\"g commit --no-verify\"'");
});

test('blocks a split flag reference inside bash -c', () => {
  mustBlock("export f=--no-verify; bash -c 'git commit $''f'");
});

test('blocks a split reference passed through eval', () => {
  mustBlock("g=git; eval '$''g commit --no-verify'");
});

console.log('\nB: shell state with many tracked names stays fast and is allowed');

test('allows 200 lines of export Vn=x; echo $Vn plus git status, within 1 s', () => {
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(`export V${i}=x; echo $V${i}`);
  allowedWithin([...lines, 'git status'].join('\n'), 1000);
});

test('allows 800 lines of vn=x; echo $vn plus git status, within 1 s', () => {
  const lines = [];
  for (let i = 0; i < 800; i++) lines.push('vn=x; echo $vn');
  allowedWithin([...lines, 'git status'].join('\n'), 1000);
});

test('allows 800 plain assignments plus git status, within 1 s', () => {
  const lines = [];
  for (let i = 0; i < 800; i++) lines.push(`v${i}=x`);
  allowedWithin([...lines, 'git status'].join('\n'), 1000);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
