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
 * ECC-owned entries are the ones whose command runs a script from the
 * `.cursor/hooks/` directory that ECC itself installs (`node .cursor/hooks/x.js`).
 * Everything else in the file belongs to the user and is kept as-is.
 */

const path = require('path');

const ECC_HOOK_COMMAND = /^\s*node\s+["']?\.cursor[\\/]hooks[\\/]/;

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

function isEccHookEntry(entry) {
  return isPlainObject(entry)
    && typeof entry.command === 'string'
    && ECC_HOOK_COMMAND.test(entry.command);
}

function parseHooksConfig(text, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(text).replace(/^﻿/, ''));
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

/**
 * ECC's source entries replace ECC's earlier entries; user entries (and any
 * event the source does not mention) are kept. Throws when the existing file is
 * not a JSON object, so the caller can leave a file it cannot interpret alone.
 */
function mergeCursorHooksConfig(existingText, sourceText) {
  const source = parseHooksConfig(sourceText, 'ECC .cursor/hooks.json');
  if (existingText === null || existingText === undefined) {
    return formatJson(source);
  }
  const existing = parseHooksConfig(existingText, 'existing hooks.json');

  const mergedHooks = {};
  const events = new Set([
    ...Object.keys(existing.hooks || {}),
    ...Object.keys(source.hooks || {}),
  ]);
  for (const event of events) {
    const sourceEntries = Array.isArray(source.hooks && source.hooks[event]) ? source.hooks[event] : [];
    const existingEntries = existing.hooks && existing.hooks[event];
    const userEntries = Array.isArray(existingEntries)
      ? existingEntries.filter(entry => !isEccHookEntry(entry))
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
 * Uninstall: drop ECC's entries and keep the user's. Returns the text to write
 * back, or null when nothing but ECC's own content remains (file can go).
 */
function stripEccHooksConfig(existingText) {
  const existing = parseHooksConfig(existingText, 'existing hooks.json');
  const hooks = {};
  for (const [event, entries] of Object.entries(existing.hooks || {})) {
    if (!Array.isArray(entries)) {
      hooks[event] = entries;
      continue;
    }
    const kept = entries.filter(entry => !isEccHookEntry(entry));
    if (kept.length > 0) hooks[event] = kept;
  }

  const { hooks: _hooks, version, ...rest } = existing;
  if (Object.keys(hooks).length === 0 && Object.keys(rest).length === 0) {
    return null;
  }
  return formatJson({
    ...(version !== undefined ? { version } : {}),
    ...rest,
    ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
  });
}

module.exports = {
  isCursorHooksOperation,
  isEccHookEntry,
  mergeCursorHooksConfig,
  stripEccHooksConfig,
};
