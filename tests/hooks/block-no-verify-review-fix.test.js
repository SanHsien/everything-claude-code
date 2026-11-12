/**
 * Regression tests for the third review batch of block-no-verify (fix-first
 * items on top of F1-F5). Each "must block" case was reproduced as an
 * allowed bypass before the fix; each "must allow" case pins legitimate input
 * that a broader check must keep allowing.
 */

'use strict';

const assert = require('assert');
const hook = require('../../scripts/hooks/block-no-verify');

const BT = '\x60'; // PowerShell escape character, written out to keep literals readable

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

function mustBlock(command) {
  const r = hook.run(JSON.stringify({ tool_input: { command } }));
  assert.strictEqual(r.exitCode, 2, `expected exit 2 for ${JSON.stringify(command).slice(0, 160)}, got ${r.exitCode}`);
  assert.ok(String(r.stderr).includes('BLOCKED'), 'stderr should contain BLOCKED');
}

function mustAllow(command) {
  const r = hook.run(JSON.stringify({ tool_input: { command } }));
  assert.strictEqual(r.exitCode, 0, `expected exit 0 for ${JSON.stringify(command).slice(0, 160)}, got ${r.exitCode}: ${r.stderr}`);
}

// --- Item 1: PowerShell reading must track double quotes ---

console.log('\nitem 1: a single quote inside double quotes does not open a single-quoted span');

test('blocks --no-verify after a double-quoted message that contains an apostrophe', () => {
  mustBlock(`git commit -m "it's" --no-ver${BT}ify -m x`);
});

test('blocks --no-verify after an earlier double-quoted apostrophe in a separate statement', () => {
  mustBlock(`Write-Output "don't"; git commit --no-ver${BT}ify -m x`);
});

test('allows a commit whose double-quoted message contains an apostrophe', () => {
  mustAllow('git commit -m "it\'s fine"');
});

// --- Item 2: variable references in quotes and call operators ---

console.log('\nitem 2: variable call through quotes or braces');

test('blocks & "$g" where $g holds git', () => {
  mustBlock('$g=\'git\'; & "$g" commit --no-verify -m x');
});

test('blocks dot-sourced quoted variable', () => {
  mustBlock('$g=\'git\'; . "$g" commit --no-verify -m x');
});

test('blocks ${g} assignment with a bare call', () => {
  mustBlock('${g}=\'git\'; & $g commit --no-verify -m x');
});

test('blocks ${g} assignment with a quoted call', () => {
  mustBlock('${g}=\'git\'; & "${g}" commit --no-verify -m x');
});

// --- Item 3: hook-skip variable names are case-insensitive ---

console.log('\nitem 3: hook-skip variable names match regardless of case');

test('blocks $env:husky=0 (lower-case name, Windows env names are case-insensitive)', () => {
  mustBlock("$env:husky='0'; git commit -m x");
});

test('blocks $env:skip with a lower-case name', () => {
  mustBlock("$env:skip='pre-commit'; git commit -m x");
});

test('still blocks the canonical upper-case HUSKY=0', () => {
  mustBlock("$env:HUSKY='0'; git commit -m x");
});

// --- Item 4: git config subcommand syntax (git 2.46+) ---

console.log('\nitem 4: git config set/unset/get/list subcommands');

test('blocks git config set core.hooksPath', () => {
  mustBlock('git config set core.hooksPath /tmp/x');
});

test('blocks git config set --global core.hooksPath', () => {
  mustBlock('git config set --global core.hooksPath x');
});

test('blocks git config unset core.hooksPath', () => {
  mustBlock('git config unset core.hooksPath');
});

test('blocks git config set include.path', () => {
  mustBlock('git config set include.path /tmp/x.cfg');
});

test('allows git config get core.hooksPath', () => {
  mustAllow('git config get core.hooksPath');
});

test('allows git config list', () => {
  mustAllow('git config list');
});

test('allows git config --get core.hooksPath (read)', () => {
  mustAllow('git config --get core.hooksPath');
});

test('allows git config set user.name (unrelated write)', () => {
  mustAllow('git config set user.name probe');
});

// --- Item 5: shell state tracking must not make long, ordinary input expensive ---

console.log('\nitem 5: long ordinary shell input stays within the analysis budget');

test('allows 200 export statements with one later reference, followed by git status', () => {
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(`export V${i}=x`);
  lines.push('echo $vn');
  mustAllow([...lines, 'git status'].join('\n'));
});

// Known boundary (documented in DECISIONS, not asserted here): 200 distinct names
// that are each referenced exhaust the analysis budget and exit 2. That is a
// false block, never a false allow.

test('allows 800 plain assignments followed by git status', () => {
  const lines = [];
  for (let i = 0; i < 800; i++) lines.push(`v${i}=x`);
  mustAllow([...lines, 'git status'].join('\n'));
});

// --- Pin: a legitimate two-level inline alias chain is allowed ---

console.log('\npin: a two-level alias chain that does not bypass hooks stays allowed');

test('allows -c alias.a=b -c alias.b=status a', () => {
  mustAllow('git -c alias.a=b -c alias.b=status a');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
