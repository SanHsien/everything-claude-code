/**
 * withCursorHookRecords reads ECC's hooks.json source when it can. When the
 * source cannot be read, the records already in the ledger must be kept
 * instead of the whole plan failing.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { withCursorHookRecords } = require('../../scripts/lib/install/cursor-hooks-merge');

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

const DEST = path.join('/project', '.cursor', 'hooks.json');
const MISSING_SOURCE = path.join('/nonexistent', 'hooks.json');
const RECORD = [{ event: 'stop', entry: { command: 'node .cursor/hooks/stop.js' } }];

function hooksOperation(extra) {
  return { kind: 'copy-file', sourceRelativePath: '.cursor/hooks.json', destinationPath: DEST, ...extra };
}

function planWithMissingSource() {
  return {
    operations: [hooksOperation({ sourcePath: MISSING_SOURCE })],
    statePreview: { operations: [hooksOperation({ sourcePath: MISSING_SOURCE })] },
  };
}

console.log('\nwithCursorHookRecords: unreadable source falls back to the ledger');

test('an unreadable source does not throw and keeps the ledger records', () => {
  const ledger = [hooksOperation({ eccEntries: RECORD })];
  const result = withCursorHookRecords(planWithMissingSource(), ledger);
  assert.deepStrictEqual(result.operations[0].eccEntries, RECORD);
  assert.deepStrictEqual(result.statePreview.operations[0].eccEntries, RECORD);
});

test('an unreadable source with no ledger record leaves the operation without eccEntries', () => {
  const result = withCursorHookRecords(planWithMissingSource(), []);
  assert.strictEqual(result.operations[0].eccEntries, undefined);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
