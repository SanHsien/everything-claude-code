/**
 * Fork regression test: security hooks registered in hooks/hooks.json must not
 * carry a short timeout. Claude Code treats a timed-out hook as a non-blocking
 * error (the tool call proceeds), so a 5 s limit on GateGuard or
 * config-protection turned any slow start (cold disk, antivirus scan) into
 * "allowed". They use the same budget as the Bash dispatcher: Claude Code's
 * default, which is longer than the 30 s bootstrap child timeout, so the
 * bootstrap decides (and blocks) before the host gives up.
 */

'use strict';

const assert = require('assert');
const path = require('path');

const hooksConfig = require(path.join('..', '..', 'hooks', 'hooks.json'));
const BOOTSTRAP_CHILD_TIMEOUT_SECONDS = 30;
const SAFETY_MARKERS = [
  'pre-bash-dispatcher.js',
  'run-with-flags.js pre:powershell:gateguard-fact-force',
  'run-with-flags.js pre:edit-write:gateguard-fact-force',
  'run-with-flags.js pre:bash:gateguard-fact-force',
  'run-with-flags.js pre:config-protection',
];

const safetyHooks = [];
for (const group of hooksConfig.hooks.PreToolUse) {
  for (const hook of group.hooks) {
    const marker = SAFETY_MARKERS.find(value => hook.command.includes(value));
    if (marker) safetyHooks.push({ marker, timeout: hook.timeout });
  }
}

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

console.log('\nsecurity hook timeouts in hooks/hooks.json');

check('every security hook entry is registered (pre-bash dispatcher, 2 GateGuard, config-protection)', () => {
  assert.deepStrictEqual(
    safetyHooks.map(hook => hook.marker).sort(),
    [
      'pre-bash-dispatcher.js',
      'run-with-flags.js pre:config-protection',
      'run-with-flags.js pre:edit-write:gateguard-fact-force',
      'run-with-flags.js pre:powershell:gateguard-fact-force',
    ]
  );
});

check('no security hook has a timeout shorter than the bootstrap child timeout', () => {
  for (const hook of safetyHooks) {
    assert.ok(
      hook.timeout === undefined || hook.timeout > BOOTSTRAP_CHILD_TIMEOUT_SECONDS,
      `${hook.marker} has timeout ${hook.timeout}s; a host-side timeout is a non-blocking error`
    );
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
