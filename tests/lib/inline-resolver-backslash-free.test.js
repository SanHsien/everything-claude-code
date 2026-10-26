'use strict';
/**
 * Native Windows runs hook commands as `bash.exe -c "<command>"`. The command
 * line passes through Windows argv quoting, MSYS argv parsing and bash
 * double-quote parsing, which collapse backslashes. A regex such as `/\\\\/g`
 * inside the inline `node -e` resolver then turns into `/\/g`, a regex literal
 * that swallows the rest of the program (SyntaxError at [eval]:1) and every
 * hook silently stops running. The inline resolver therefore must not contain
 * a backslash at all.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const BACKSLASH = String.fromCharCode(92);
const { INLINE_RESOLVE } = require(path.join(root, 'scripts/lib/resolve-ecc-root.js'));
const { INLINE_WSL_CONVERSION } = require(path.join(root, 'scripts/lib/install-targets/helpers.js'));

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}\n${error.stack}`);
  }
}

function hookCommands(file) {
  const config = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const commands = [];
  for (const groups of Object.values(config.hooks || {})) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        if (typeof hook.command === 'string') commands.push(hook.command);
      }
    }
  }
  return commands;
}

check('inline resolver source strings contain no backslash', () => {
  assert.ok(!INLINE_RESOLVE.includes(BACKSLASH), 'INLINE_RESOLVE');
  assert.ok(!INLINE_WSL_CONVERSION.includes(BACKSLASH), 'INLINE_WSL_CONVERSION');
});

check('inline resolver snippets avoid the word "test" so the command registry does not misclassify commands', () => {
  assert.ok(!/test/i.test(INLINE_RESOLVE), 'INLINE_RESOLVE');
  assert.ok(!/test/i.test(INLINE_WSL_CONVERSION), 'INLINE_WSL_CONVERSION');
});

check('commands embedding the inline resolver keep their registry type', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'docs/COMMAND-REGISTRY.json'), 'utf8'));
  const expected = { 'instinct-status': 'review', 'skill-health': 'review', sessions: 'general', 'skill-host-compat': 'general' };
  const types = Object.fromEntries(registry.commands.map(command => [command.command, command.type]));
  for (const [name, type] of Object.entries(expected)) {
    assert.strictEqual(types[name], type, `${name} type`);
  }
});

for (const file of ['hooks/hooks.json', 'hooks/codex-hooks.json']) {
  check(`${file} node -e commands contain no backslash`, () => {
    const commands = hookCommands(file).filter(command => command.startsWith('node -e'));
    assert.ok(commands.length > 0, 'expected inline node -e commands');
    for (const command of commands) {
      assert.ok(!command.includes(BACKSLASH), `backslash in: ${command.slice(0, 120)}`);
    }
  });
}

for (const file of fs.readdirSync(path.join(root, 'commands')).filter(name => name.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(root, 'commands', file), 'utf8');
  if (!text.includes("'/proc/version'")) continue;
  check(`commands/${file} inline resolver snippets contain no backslash`, () => {
    for (const line of text.split(/\r?\n/).filter(entry => entry.includes("'/proc/version'"))) {
      assert.ok(!line.includes(BACKSLASH), `backslash in: ${line.slice(0, 120)}`);
    }
  });
}

function convert(input, { platform = 'linux', version = 'Linux version 5.15 Microsoft-standard-WSL2' } = {}) {
  const run = new Function('o', 'f', 'd', `${INLINE_WSL_CONVERSION}return d`);
  return run({ platform: () => platform }, { readFileSync: () => version }, input);
}

check('WSL conversion maps Windows drive paths to /mnt and leaves others alone', () => {
  assert.strictEqual(convert(['C:', 'Users', 'me', '.claude'].join(BACKSLASH)), '/mnt/c/Users/me/.claude');
  assert.strictEqual(convert('D:/Projects/x'), '/mnt/d/Projects/x');
  assert.strictEqual(convert('/home/me/.claude'), '/home/me/.claude');
  assert.strictEqual(convert('relative/dir'), 'relative/dir');
  assert.strictEqual(convert('C:'), 'C:');
  assert.strictEqual(convert(['C:', 'Users'].join(BACKSLASH), { version: 'Linux version 6.1 generic' }),
    ['C:', 'Users'].join(BACKSLASH), 'plain Linux kernels are not WSL');
  assert.strictEqual(convert(['C:', 'Users'].join(BACKSLASH), { platform: 'win32' }),
    ['C:', 'Users'].join(BACKSLASH), 'only Linux runs the conversion');
});

const bash = spawnSync('bash', ['--version'], { encoding: 'utf8' });
if (bash.status !== 0) {
  console.log('SKIP bash unavailable; quoting survival is covered by the static backslash checks');
} else {
  check('inline resolver survives bash -c quoting and returns the explicit root', () => {
    const command = `node -e "const root=${INLINE_RESOLVE};process.stdout.write(String(root))"`;
    const result = spawnSync('bash', ['-c', command], {
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: 'explicit-root' },
    });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(result.stdout, 'explicit-root');
  });
}

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exitCode = failed ? 1 : 0;
