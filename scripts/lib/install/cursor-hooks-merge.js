'use strict';

/**
 * Fork-owned: merge ECC's Cursor hook entries into `.cursor/hooks.json`
 * instead of overwriting the file.
 *
 * `.cursor/hooks.json` is a shared config. ECC records it as a managed copy,
 * so every reinstall/repair rewrote the whole file and silently dropped hooks
 * the user had added since the last install, and uninstall deleted the file
 * together with them.
 *
 * Ownership is per entry, not per command string. The install-state ledger
 * records, on the hooks.json operation, the exact `{ event, entry }` pairs ECC
 * wrote (`eccEntries`). Reinstall and uninstall remove an existing entry only
 * when it matches a recorded pair in full (same event and identical content),
 * one occurrence per record. A user entry that shares a command with ECC's but
 * sits under another event or has other fields is therefore kept.
 *
 * A ledger written before this rule has no `eccEntries`. For that ledger ECC's
 * source is used instead: an existing entry is claimed only when it equals a
 * source entry (same event and content), and each source entry claims at most
 * one. Entries that do not match are kept.
 *
 * Cursor runs every matching hook from a hooks.json and merges the responses
 * (any deny wins), so ECC's entries go first and the user's follow them.
 */

const fs = require('fs');
const path = require('path');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** The managed Cursor hooks.json copy operation (recorded or planned). */
function isCursorHooksOperation(operation) {
  if (!operation || operation.kind !== 'copy-file') return false;
  const source = String(operation.sourceRelativePath || '').replace(/\\/g, '/');
  return source === '.cursor/hooks.json'
    && path.basename(String(operation.destinationPath || '')).toLowerCase() === 'hooks.json';
}

function parseHooksConfig(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  if (parsed.hooks !== undefined && !isPlainObject(parsed.hooks)) {
    throw new Error(`${label} has a non-object "hooks" value`);
  }
  return parsed;
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// Key-sorted serialization, so two entries compare by content and not by the
// order their keys happened to be written in.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The `{ event, entry }` pairs ECC's source hooks.json defines. These are what
 * an install inserts, so the install records them in the ledger.
 *
 * @param {string} sourceText ECC's `.cursor/hooks.json`.
 * @returns {{ event: string, entry: object }[]}
 */
function listEccHookRecords(sourceText) {
  const source = parseHooksConfig(sourceText, 'ECC .cursor/hooks.json');
  const records = [];
  for (const [event, entries] of Object.entries(source.hooks || {})) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (isPlainObject(entry)) records.push({ event, entry: JSON.parse(JSON.stringify(entry)) });
    }
  }
  return records;
}

/**
 * The records the ledger holds for the hooks.json operation. A ledger entry
 * without `eccEntries` contributes nothing.
 *
 * @param {object[]} managedOperations Recorded managed install-state operations.
 * @returns {{ event: string, entry: object }[]}
 */
function recordedEccEntries(managedOperations = []) {
  const records = [];
  for (const operation of managedOperations) {
    if (!isCursorHooksOperation(operation) || !Array.isArray(operation.eccEntries)) continue;
    for (const record of operation.eccEntries) {
      if (isPlainObject(record) && typeof record.event === 'string' && isPlainObject(record.entry)) {
        records.push({ event: record.event, entry: record.entry });
      }
    }
  }
  return records;
}

function recordsForEvent(records, event) {
  return records.filter(record => record.event === event);
}

/**
 * The records existing entries are matched against. Ledger records are used as
 * they are. A hooks.json operation from before per-entry records has none, so
 * when ECC's source text is available its entries are matched instead.
 *
 * @param {object[]} managedOperations Recorded managed install-state operations.
 * @param {string|null} sourceText ECC's `.cursor/hooks.json`, or null when unavailable.
 * @returns {{ event: string, entry: object }[]}
 */
function eccEntryRecords(managedOperations = [], sourceText = null) {
  const records = recordedEccEntries(managedOperations);
  const legacy = managedOperations.some(operation => isCursorHooksOperation(operation) && !Array.isArray(operation.eccEntries));
  if (legacy && typeof sourceText === 'string') records.push(...listEccHookRecords(sourceText));
  return records;
}

/**
 * Take out one existing entry per record that matches it in full. Entries that
 * no record claims are returned in their original order.
 */
function claimRecordedEntries(entries, records) {
  const remaining = [...entries];
  let removed = 0;
  for (const record of records) {
    const wanted = canonicalJson(record.entry);
    const index = remaining.findIndex(entry => canonicalJson(entry) === wanted);
    if (index === -1) continue;
    remaining.splice(index, 1);
    removed++;
  }
  return { remaining, removed };
}

/**
 * ECC's source entries replace ECC's earlier entries; user entries (and any
 * event the source does not mention) are kept. Throws when the existing file is
 * not a JSON object, so the caller can leave a file it cannot interpret alone.
 */
function mergeCursorHooksConfig(existingText, sourceText, managedOperations = []) {
  const source = parseHooksConfig(sourceText, 'ECC .cursor/hooks.json');
  if (existingText === null || existingText === undefined) {
    return formatJson(source);
  }
  const existing = parseHooksConfig(existingText, 'existing hooks.json');
  const records = eccEntryRecords(managedOperations, sourceText);

  const mergedHooks = {};
  const events = new Set([
    ...Object.keys(existing.hooks || {}),
    ...Object.keys(source.hooks || {}),
  ]);
  for (const event of events) {
    const sourceEntries = Array.isArray(source.hooks && source.hooks[event]) ? source.hooks[event] : [];
    const existingEntries = existing.hooks && existing.hooks[event];
    const userEntries = Array.isArray(existingEntries)
      ? claimRecordedEntries(existingEntries, recordsForEvent(records, event)).remaining
      : [];
    const combined = [...sourceEntries, ...userEntries];
    if (combined.length > 0) mergedHooks[event] = combined;
    // A non-array value under an event is the user's: keep it untouched.
    else if (existingEntries !== undefined && !Array.isArray(existingEntries)) mergedHooks[event] = existingEntries;
  }

  const { hooks: _sourceHooks, ...sourceRest } = source;
  const { hooks: _existingHooks, ...existingRest } = existing;
  return formatJson({ ...sourceRest, ...existingRest, hooks: mergedHooks });
}

/**
 * Uninstall: drop the entries the ledger records as ECC's and keep the rest.
 *
 * @param {string} existingText The current hooks.json text.
 * @param {{ event: string, entry: object }[]} records From recordedEccEntries().
 * @returns {{ changed: boolean, text: string|null }} `text` is what to write
 *   back, or null when the file held nothing but ECC's entries and can go.
 *   When no ECC entry was found the file is returned untouched.
 */
function stripEccHooksConfig(existingText, records = []) {
  const existing = parseHooksConfig(existingText, 'existing hooks.json');
  let removed = 0;
  const hooks = {};
  for (const [event, entries] of Object.entries(existing.hooks || {})) {
    if (!Array.isArray(entries)) {
      hooks[event] = entries;
      continue;
    }
    const claim = claimRecordedEntries(entries, recordsForEvent(records, event));
    removed += claim.removed;
    if (claim.remaining.length > 0) hooks[event] = claim.remaining;
    else if (entries.length === 0) hooks[event] = entries; // the user's empty list, not ours
  }
  if (removed === 0) return { changed: false, text: existingText };

  const { hooks: _hooks, version, ...rest } = existing;
  if (Object.keys(hooks).length === 0 && Object.keys(rest).length === 0) {
    return { changed: true, text: null };
  }
  return {
    changed: true,
    text: formatJson({
      ...(version !== undefined ? { version } : {}),
      ...rest,
      ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
    }),
  };
}

/**
 * Attach `eccEntries` to the hooks.json operation of a plan, in both the writes
 * and the ledger preview. The records come from ECC's source when it can be
 * read; otherwise from the ledger operation already recorded for the same
 * destination, so a repair that cannot read the source keeps them.
 *
 * @param {object} plan An install plan with `operations` and `statePreview`.
 * @param {object[]} [recordedOperations] Managed operations from the ledger.
 */
function withCursorHookRecords(plan, recordedOperations = []) {
  const known = new Map();
  for (const operation of recordedOperations) {
    if (isCursorHooksOperation(operation) && Array.isArray(operation.eccEntries)) {
      known.set(operation.destinationPath, operation.eccEntries);
    }
  }
  for (const operation of plan.operations) {
    if (!isCursorHooksOperation(operation) || typeof operation.sourcePath !== 'string') continue;
    let records;
    try {
      records = listEccHookRecords(fs.readFileSync(operation.sourcePath, 'utf8'));
    } catch (_error) {
      continue; // source unreadable: keep whatever the ledger recorded for this destination
    }
    known.set(operation.destinationPath, records);
  }
  if (known.size === 0) return plan;
  const attach = operation => (
    isCursorHooksOperation(operation) && known.has(operation.destinationPath)
      ? { ...operation, eccEntries: known.get(operation.destinationPath) }
      : operation
  );
  return {
    ...plan,
    operations: plan.operations.map(attach),
    statePreview: {
      ...plan.statePreview,
      operations: plan.statePreview.operations.map(attach),
    },
  };
}

module.exports = {
  isCursorHooksOperation,
  listEccHookRecords,
  mergeCursorHooksConfig,
  eccEntryRecords,
  recordedEccEntries,
  stripEccHooksConfig,
  withCursorHookRecords,
};
