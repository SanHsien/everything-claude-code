/**
 * Fork regression tests: formatter hooks on Windows must pass ordinary paths
 * (spaces, parentheses, &, %, !) to a .cmd shim as ONE argument each, without
 * `shell: true` and without silently skipping the file.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const { buildCmdShimInvocation, isWindowsCmdShim } = require('../../scripts/lib/windows-cmd');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-format-paths-'));
process.once('exit', () => fs.rmSync(sandbox, { recursive: true, force: true }));

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${error.message}`);
    failed++;
  }
}

console.log('\nwindows-cmd invocation builder');

check('arguments never appear in the cmd.exe command line; each travels in its own env token', () => {
  const hostile = 'C:\\Users\\John Doe\\p (1)\\a&b ^c %PATH% !x!.js';
  const invocation = buildCmdShimInvocation('C:\\Program Files\\tool\\fmt.cmd', ['--write', hostile], {
    cwd: 'C:\\x',
    timeout: 1234,
    env: { KEEP: '1', ECC_CMD_TOKEN_9: 'stale' },
  });
  assert.strictEqual(invocation.options.shell, false);
  assert.strictEqual(invocation.options.windowsVerbatimArguments, true);
  assert.strictEqual(invocation.options.cwd, 'C:\\x');
  assert.strictEqual(invocation.options.timeout, 1234);
  const commandLine = invocation.args[invocation.args.length - 1];
  assert.ok(!commandLine.includes('John Doe'), commandLine);
  assert.ok(!commandLine.includes('&'), commandLine);
  assert.strictEqual(commandLine, '""%ECC_CMD_TOKEN_0%" "%ECC_CMD_TOKEN_1%" "%ECC_CMD_TOKEN_2%""');
  assert.strictEqual(invocation.options.env.ECC_CMD_TOKEN_2, hostile);
  assert.strictEqual(invocation.options.env.ECC_CMD_TOKEN_9, undefined, 'stale tokens are cleared');
  assert.strictEqual(invocation.options.env.KEEP, '1');
  assert.deepStrictEqual(invocation.args.slice(0, 4), ['/d', '/v:off', '/s', '/c']);
});

check('a value that could leave the quoted token is rejected', () => {
  for (const bad of ['a"b', 'a\nb', 'a\rb', 'a\0b']) {
    assert.throws(() => buildCmdShimInvocation('C:\\fmt.cmd', [bad]), /Unsafe character/);
  }
});

check('only .cmd/.bat on win32 count as shims', () => {
  assert.strictEqual(isWindowsCmdShim('C:\\x\\prettier.CMD', 'win32'), true);
  assert.strictEqual(isWindowsCmdShim('C:\\x\\run.bat', 'win32'), true);
  assert.strictEqual(isWindowsCmdShim('C:\\x\\node.exe', 'win32'), false);
  assert.strictEqual(isWindowsCmdShim('/usr/bin/prettier.cmd', 'linux'), false);
});

console.log('\nformatter hooks with a real .cmd shim (Windows only)');

function createFormatterFixture(name) {
  const fixtureRoot = path.join(sandbox, name);
  const shimDir = path.join(fixtureRoot, 'bin dir (x86)');
  const projectRoot = path.join(fixtureRoot, 'Project Folder & Co (copy)');
  fs.mkdirSync(shimDir, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  const logFile = path.join(fixtureRoot, 'args.log');
  const shim = path.join(shimDir, 'fmt.cmd');
  // Writes each of the first three arguments, quoted, on its own line.
  fs.writeFileSync(shim, [
    '@echo off',
    'echo "%~1">>"%ECC_TEST_ARGLOG%"',
    'echo "%~2">>"%ECC_TEST_ARGLOG%"',
    'echo "%~3">>"%ECC_TEST_ARGLOG%"',
    ''
  ].join('\r\n'));
  const target = path.join(projectRoot, 'a file!100% (final) & more.js');
  fs.writeFileSync(target, 'const a = 1\n');
  return { fixtureRoot, projectRoot, shim, logFile, target };
}

function withStubbedFormatter(fixture, fn) {
  const resolverPath = require.resolve(path.join(repoRoot, 'scripts', 'lib', 'resolve-formatter'));
  const resolver = require(resolverPath);
  const original = { ...resolver };
  const saved = process.env.ECC_TEST_ARGLOG;
  process.env.ECC_TEST_ARGLOG = fixture.logFile;
  Object.assign(resolver, {
    findProjectRoot: () => fixture.projectRoot,
    detectFormatter: () => 'prettier',
    resolveFormatterBin: () => ({ bin: fixture.shim, prefix: [] }),
  });
  const hookModules = ['post-edit-format', 'stop-format-typecheck']
    .map(name => require.resolve(path.join(repoRoot, 'scripts', 'hooks', name)));
  hookModules.forEach(modulePath => delete require.cache[modulePath]);
  try {
    return fn();
  } finally {
    Object.assign(resolver, original);
    hookModules.forEach(modulePath => delete require.cache[modulePath]);
    if (saved === undefined) delete process.env.ECC_TEST_ARGLOG;
    else process.env.ECC_TEST_ARGLOG = saved;
  }
}

function readLoggedArgs(fixture) {
  assert.ok(fs.existsSync(fixture.logFile), 'the formatter shim was never run');
  return fs.readFileSync(fixture.logFile, 'utf8').split(/\r?\n/).filter(Boolean);
}

if (process.platform === 'win32') {
  check('post-edit-format passes a path with spaces, parentheses, &, % and ! as one argument', () => {
    const fixture = createFormatterFixture('post-edit');
    withStubbedFormatter(fixture, () => {
      const { run } = require(path.join(repoRoot, 'scripts', 'hooks', 'post-edit-format'));
      const raw = JSON.stringify({ tool_input: { file_path: fixture.target } });
      assert.strictEqual(run(raw), raw, 'hook must still pass its input through');
    });
    assert.deepStrictEqual(readLoggedArgs(fixture), ['"--write"', `"${fixture.target}"`, '""']);
  });

  check('stop-format-typecheck formats a batch whose path contains spaces and metacharacters', () => {
    const fixture = createFormatterFixture('stop');
    const sessionId = `format-paths-${process.pid}`;
    const accumFile = path.join(os.tmpdir(), `ecc-edited-${sessionId}.txt`);
    fs.writeFileSync(accumFile, `${fixture.target}\n`);
    const savedSession = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = sessionId;
    try {
      withStubbedFormatter(fixture, () => {
        const { run } = require(path.join(repoRoot, 'scripts', 'hooks', 'stop-format-typecheck'));
        run('{}');
      });
    } finally {
      if (savedSession === undefined) delete process.env.CLAUDE_SESSION_ID;
      else process.env.CLAUDE_SESSION_ID = savedSession;
      fs.rmSync(accumFile, { force: true });
    }
    assert.deepStrictEqual(readLoggedArgs(fixture), ['"--write"', `"${fixture.target}"`, '""']);
  });

  check('a file name that cannot be passed safely is skipped with a message, not run', () => {
    // A double quote cannot occur in a real Windows path; simulate it via a prefix.
    const fixture = createFormatterFixture('unsafe');
    const resolver = require(path.join(repoRoot, 'scripts', 'lib', 'resolve-formatter'));
    const original = { ...resolver };
    try {
      withStubbedFormatter(fixture, () => {
        const { run } = require(path.join(repoRoot, 'scripts', 'hooks', 'post-edit-format'));
        const raw = JSON.stringify({ tool_input: { file_path: path.join(fixture.projectRoot, 'we"ird.js') } });
        assert.strictEqual(run(raw), raw);
      });
    } finally {
      Object.assign(resolver, original);
    }
    assert.ok(!fs.existsSync(fixture.logFile), 'shim must not run for an unsafe token');
  });
} else {
  console.log('  SKIP real .cmd shim checks (not win32)');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
