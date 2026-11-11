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
 * An entry is ECC's only when its `command` is exactly one ECC knows it wrote:
 *  - a command in ECC's own `.cursor/hooks.json` source, or
 *  - `node .cursor/hooks/<file>` for a file the install-state ledger records as
 *    ECC-installed under `.cursor/hooks/` (this covers entries written by older
 *    ECC versions whose scripts are no longer in the source).
 * A user's own `node .cursor/hooks/my-script.js` is therefore never touched,
 * even though it lives next to ECC's scripts.
 *
 * Cursor runs every matching hook from a hooks.json and merges the responses
 * (any deny wins), so ECC's entries go first and the user's follow them.
 */

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

const ECC_HOOKS_DIR_FILE = /(?:^|\/)\.cursor\/hooks\/(.+)$/;

/**
 * Commands ECC owns: those in its source hooks.json plus the scripts the ledger
 * says ECC installed under `.cursor/hooks/`.
 *
 * @param {string|null} sourceText ECC's `.cursor/hooks.json` (null when unavailable, e.g. uninstall).
 * @param {object[]} managedOperations Recorded managed install-state operations.
 * @returns {Set<string>}
 */
function collectEccCommands(sourceText, managedOperations = []) {
  const commands = new Set();
  if (sourceText !== null && sourceText !== undefined) {
    const source = parseHooksConfig(sourceText, 'ECC .cursor/hooks.json');
    for (const entries of Object.values(source.hooks || {})) {
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (isPlainObject(entry) && typeof entry.command === 'string') commands.add(entry.command);
      }
    }
  }
  for (const operation of managedOperations) {
    if (!operation || operation.kind !== 'copy-file' || typeof operation.destinationPath !== 'string') continue;
    const match = ECC_HOOKS_DIR_FILE.exec(operation.destinationPath.replace(/\\/g, '/'));
    if (match) commands.add(`node .cursor/hooks/${match[1]}`);
  }
  return commands;
}

function isEccHookEntry(entry, eccCommands) {
  return isPlainObject(entry) && typeof entry.command === 'string' && eccCommands.has(entry.command);
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
  const eccCommands = collectEccCommands(sourceText, managedOperations);

  const mergedHooks = {};
  const events = new Set([
    ...Object.keys(existing.hooks || {}),
    ...Object.keys(source.hooks || {}),
  ]);
  for (const event of events) {
    const sourceEntries = Array.isArray(source.hooks && source.hooks[event]) ? source.hooks[event] : [];
    const existingEntries = existing.hooks && existing.hooks[event];
    const userEntries = Array.isArray(existingEntries)
      ? existingEntries.filter(entry => !isEccHookEntry(entry, eccCommands))
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
 * Uninstall: drop ECC's entries and keep the user's.
 *
 * @returns {{ changed: boolean, text: string|null }} `text` is what to write
 *   back, or null when the file held nothing but ECC's entries and can go.
 *   When no ECC entry was found the file is returned untouched.
 */
function stripEccHooksConfig(existingText, eccCommands) {
  const existing = parseHooksConfig(existingText, 'existing hooks.json');
  let removed = 0;
  const hooks = {};
  for (const [event, entries] of Object.entries(existing.hooks || {})) {
    if (!Array.isArray(entries)) {
      hooks[event] = entries;
      continue;
    }
    const kept = entries.filter(entry => !isEccHookEntry(entry, eccCommands));
    removed += entries.length - kept.length;
    if (kept.length > 0) hooks[event] = kept;
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

module.exports = {
  collectEccCommands,
  isCursorHooksOperation,
  isEccHookEntry,
  mergeCursorHooksConfig,
  stripEccHooksConfig,
};
