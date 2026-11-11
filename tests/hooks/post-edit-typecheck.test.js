/**
 * Fork regression tests for scripts/hooks/post-edit-typecheck.js (legacy hook).
 *
 * On Windows the hook ran `npx.cmd` through execFileSync, which cannot launch a
 * .cmd shim (EINVAL); the catch block then treated the launch error as "tsc
 * reported errors", found no diagnostics and stayed silent. A type check that
 * never ran looked identical to a clean one.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const hook = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'post-edit-typecheck.js');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-typecheck-'));
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

function makeProject(name) {
  const dir = path.join(sandbox, name);
  const binDir = path.join(dir, 'fake-bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  const file = path.join(dir, 'example.ts');
  fs.writeFileSync(file, 'const a: number = "wrong";\n');
  return { dir, binDir, file };
}

function runHook(project, pathValue) {
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_input: { file_path: project.file } }),
    encoding: 'utf8',
    cwd: project.dir,
    env: { ...process.env, PATH: pathValue, Path: pathValue },
    timeout: 60000,
  });
}

console.log('\npost-edit-typecheck.js');

if (process.platform === 'win32') {
  check('a Windows npx.cmd shim is launched and its diagnostics for the edited file are reported', () => {
    const project = makeProject('shim');
    fs.writeFileSync(
      path.join(project.binDir, 'npx.cmd'),
      '@echo off\r\necho example.ts(1,7): error TS2322: Type "string" is not assignable to type "number".\r\nexit /b 2\r\n'
    );
    const result = runHook(project, project.binDir + path.delimiter + process.env.PATH);
    assert.strictEqual(result.status, 0, 'the hook itself never blocks');
    assert.match(result.stderr, /TypeScript errors in example\.ts/);
    assert.match(result.stderr, /TS2322/);
  });
}

check('a type check that cannot start is reported, not silently treated as clean', () => {
  const project = makeProject('missing');
  // Nothing on PATH can provide npx, so the check cannot run on any platform.
  const result = runHook(project, project.binDir);
  assert.strictEqual(result.status, 0, 'the hook itself never blocks');
  assert.match(result.stderr, /TypeScript check/i, `stderr was: ${JSON.stringify(result.stderr)}`);
  assert.match(result.stderr, /not run|without diagnostics/i);
});

check('stdin is still passed through unchanged', () => {
  const project = makeProject('passthrough');
  const raw = JSON.stringify({ tool_input: { file_path: project.file } });
  const result = spawnSync(process.execPath, [hook], {
    input: raw, encoding: 'utf8', cwd: project.dir,
    env: { ...process.env, PATH: project.binDir, Path: project.binDir }, timeout: 60000,
  });
  assert.strictEqual(result.stdout, raw);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
