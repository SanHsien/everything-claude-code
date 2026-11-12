/**
 * Regression tests for the second review batch of block-no-verify (F1-F4).
 *
 * Each case below was reproduced against the hook before the fix. The
 * "must allow" cases pin legitimate inputs that a broader check must not
 * start denying.
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

function mustBlock(command) {
  const r = hook.run(JSON.stringify({ tool_input: { command } }));
  assert.strictEqual(r.exitCode, 2, `expected exit 2 for ${JSON.stringify(command)}, got ${r.exitCode}`);
  assert.ok(String(r.stderr).includes('BLOCKED'), 'stderr should contain BLOCKED');
}

function mustAllow(command) {
  const r = hook.run(JSON.stringify({ tool_input: { command } }));
  assert.strictEqual(r.exitCode, 0, `expected exit 0 for ${JSON.stringify(command)}, got ${r.exitCode}: ${r.stderr}`);
}

// --- F1: an inline git alias defined in the same command ---

console.log('\nF1: inline git alias (-c alias.<name>=...) is expanded before the check');

test('blocks an alias that expands to commit --no-verify', () => {
  mustBlock("git -c alias.ci='commit --no-verify' ci -m probe");
});

test('blocks the double-quoted form of the same alias', () => {
  mustBlock('git -c alias.ci="commit --no-verify" ci -m probe');
});

test('blocks a chained alias (alias to alias to commit --no-verify)', () => {
  mustBlock("git -c alias.a=ci -c alias.ci='commit --no-verify' a -m probe");
});

test('blocks a shell alias (! prefix) whose body runs git commit --no-verify', () => {
  mustBlock("git -c alias.ci='!git commit --no-verify -m probe' ci");
});

test('allows an inline alias whose expansion does not bypass hooks', () => {
  mustAllow("git -c alias.ci='commit -m probe' ci");
  mustAllow("git -c alias.st=status st");
});

test('blocks a literal variable used as the git executable (g=git; $g commit)', () => {
  mustBlock('g=git; $g commit --no-verify -m probe');
});

test('blocks a literal variable holding the flag (f=--no-verify; git commit "$f")', () => {
  mustBlock('f=--no-verify; git commit "$f" -m probe');
  mustBlock('f=--no-verify; git commit $f -m probe');
});

test('allows a variable that holds a non-git command', () => {
  mustAllow('g=echo; $g commit --no-verify');
  mustAllow('g=git; $g commit -m probe');
});

test('allows the alias name when the subcommand is not aliased', () => {
  mustAllow("git -c alias.ci='commit --no-verify' status");
});

// --- F2: PowerShell escape and variable syntax ---

console.log('\nF2: PowerShell backtick escapes and constant variables');

test('blocks a PowerShell backtick split of --no-verify', () => {
  mustBlock('git commit --no-ver`ify -m probe');
});

test('blocks a PowerShell constant variable used as the executable', () => {
  mustBlock("$g='git'; & $g commit --no-verify -m probe");
});

test('allows a single-quoted data argument that looks like --no-verify', () => {
  mustAllow("git commit -m '--no-verify'");
  mustAllow("echo 'git commit --no-verify'");
});

// --- F3: hook-skipping environment variables ---

console.log('\nF3: HUSKY / SKIP environment set on a protected git command');

test('blocks HUSKY=0 as an inline prefix', () => {
  mustBlock('HUSKY=0 git commit -m probe');
});

test('blocks SKIP=pre-commit as an inline prefix', () => {
  mustBlock('SKIP=pre-commit git commit -m probe');
});

test('blocks env HUSKY=0 and env SKIP=pre-commit wrappers', () => {
  mustBlock('env HUSKY=0 git commit -m probe');
  mustBlock('env SKIP=pre-commit git commit -m probe');
});

test('blocks SKIP exported earlier in the same command', () => {
  mustBlock('export SKIP=pre-commit; git commit -m probe');
});

test('blocks PowerShell $env:HUSKY assignment before git commit', () => {
  mustBlock("$env:HUSKY='0'; git commit -m probe");
});

test('allows HUSKY set to a non-disabling value', () => {
  mustAllow('HUSKY=1 git commit -m probe');
});

test('allows an empty SKIP value', () => {
  mustAllow('SKIP= git commit -m probe');
});

test('allows the same variables on a command that is not a protected git operation', () => {
  mustAllow('SKIP=pre-commit echo hi');
  mustAllow('echo SKIP=pre-commit');
});

// --- F4: persistent hooksPath / include changes through git config ---

console.log('\nF4: git config writes that redirect hooks or include other config');

test('blocks git config core.hooksPath followed by a commit', () => {
  mustBlock('git config core.hooksPath /dev/null && git commit -m probe');
});

test('blocks a global or local hooksPath write', () => {
  mustBlock('git config --global core.hooksPath /tmp/x');
  mustBlock('git config --local core.hooksPath /tmp/x');
});

test('blocks unsetting core.hooksPath', () => {
  mustBlock('git config --unset core.hooksPath');
});

test('blocks an include.path write', () => {
  mustBlock('git config include.path /tmp/evil.gitconfig');
});

test('allows reading core.hooksPath', () => {
  mustAllow('git config core.hooksPath');
  mustAllow('git config --get core.hooksPath');
});

test('allows an unrelated config write', () => {
  mustAllow('git config user.name probe');
});

// --- Legitimate inputs that must not be denied ---

console.log('\nlegitimate inputs stay allowed');

test('git commit -mn treats n as the message', () => {
  mustAllow('git commit -mn');
});

test('a plain commit with a quoted message is allowed', () => {
  mustAllow('git commit -m "hello"');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
