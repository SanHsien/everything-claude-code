'use strict';

/**
 * Fork-owned guard: ECC must only change MCP server entries it manages.
 *
 * A `merge-json` operation into an MCP config (`.cursor/mcp.json`,
 * `.kimi-code/mcp.json`, ...) used to deep-merge ECC's bundled `mcpServers`
 * over the user's file, so a same-named server the user had configured with
 * their own `command`/`args`/`env` was silently replaced by ECC's definition.
 *
 * Per server name, against the existing file and the previous install-state:
 *   - absent                          -> add ECC's definition
 *   - equals ECC's definition         -> nothing to do
 *   - equals what ECC installed last  -> ECC still owns it, update it
 *   - anything else                   -> user's own entry: keep it, warn, and
 *                                        stop claiming it in the ledger so
 *                                        repair/uninstall never touch it
 */

const fs = require('fs');
const path = require('path');

const { readInstallState } = require('../install-state');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isMcpConfigPath(filePath) {
  const basename = path.basename(String(filePath || ''));
  return basename === '.mcp.json' || basename === 'mcp.json';
}

function isMcpServerMerge(operation) {
  return Boolean(operation)
    && operation.kind === 'merge-json'
    && isMcpConfigPath(operation.destinationPath)
    && isPlainObject(operation.mergePayload)
    && isPlainObject(operation.mergePayload.mcpServers);
}

function comparablePath(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function sameJson(left, right) {
  return canonical(left) === canonical(right);
}

/** Existing `mcpServers` of the destination, or null when it cannot be read as an object. */
function readExistingServers(destinationPath) {
  let text;
  try {
    text = fs.readFileSync(destinationPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) return null;
    if (parsed.mcpServers === undefined) return {};
    return isPlainObject(parsed.mcpServers) ? parsed.mcpServers : null;
  } catch (_error) {
    return null;
  }
}

function previousServersFor(previousOperation) {
  const payload = previousOperation && previousOperation.mergePayload;
  return isPlainObject(payload) && isPlainObject(payload.mcpServers) ? payload.mcpServers : {};
}

/**
 * Names in `desiredServers` that collide with a user-owned entry.
 * `existingServers` must be an object (callers skip unreadable files).
 */
function findUserOwnedServerConflicts(existingServers, desiredServers, previousServers = {}) {
  const conflicts = [];
  for (const [name, desired] of Object.entries(desiredServers)) {
    if (!Object.prototype.hasOwnProperty.call(existingServers, name)) continue;
    const current = existingServers[name];
    if (sameJson(current, desired)) continue;
    if (
      Object.prototype.hasOwnProperty.call(previousServers, name)
      && sameJson(current, previousServers[name])
    ) {
      continue;
    }
    conflicts.push(name);
  }
  return conflicts;
}

/**
 * Merge ECC's payload into an existing MCP config. Managed servers replace the
 * previous entry wholesale (a half-old, half-new command/args/env must never
 * result); every other key and server is kept.
 */
function mergeMcpConfig(currentValue, payload, deepMerge) {
  const { mcpServers: payloadServers, ...rest } = payload;
  const base = isPlainObject(currentValue) ? currentValue : {};
  const merged = deepMerge(base, rest);
  merged.mcpServers = { ...(isPlainObject(base.mcpServers) ? base.mcpServers : {}) };
  for (const [name, server] of Object.entries(payloadServers || {})) {
    merged.mcpServers[name] = JSON.parse(JSON.stringify(server));
  }
  return merged;
}

function readPreviousState(plan) {
  if (!plan || !plan.installStatePath) return null;
  try {
    if (!fs.existsSync(plan.installStatePath)) return null;
    return readInstallState(plan.installStatePath);
  } catch (_error) {
    // A broken ledger proves no ownership; the safe direction is to preserve.
    return null;
  }
}

function previousOperationFor(previousState, destinationPath) {
  if (!previousState || !Array.isArray(previousState.operations)) return null;
  const key = comparablePath(destinationPath);
  return previousState.operations.find(operation => (
    operation
    && operation.kind === 'merge-json'
    && operation.ownership === 'managed'
    && typeof operation.destinationPath === 'string'
    && comparablePath(operation.destinationPath) === key
  )) || null;
}

/**
 * Plan-level adjustment applied before any migration/ownership bookkeeping:
 * removes user-owned servers from every MCP merge payload (operations and
 * statePreview, so writes, recovery checkpoints and the final ledger agree)
 * and reports them as warnings.
 */
function withPreservedUserMcpServers(plan) {
  if (!plan || !Array.isArray(plan.operations) || !plan.operations.some(isMcpServerMerge)) {
    return plan;
  }

  const previousState = readPreviousState(plan);
  const warnings = [];
  const adjusted = new Map();

  for (const operation of plan.operations.filter(isMcpServerMerge)) {
    const existing = readExistingServers(operation.destinationPath);
    if (existing === null) continue; // invalid JSON etc.: the write step reports it
    const conflicts = findUserOwnedServerConflicts(
      existing,
      operation.mergePayload.mcpServers,
      previousServersFor(previousOperationFor(previousState, operation.destinationPath))
    );
    if (conflicts.length === 0) continue;

    const servers = { ...operation.mergePayload.mcpServers };
    for (const name of conflicts) {
      delete servers[name];
      warnings.push(
        `Preserved user MCP server "${name}" in ${operation.destinationPath}: it differs from ECC's definition and is not recorded as ECC-managed. ECC did not overwrite it; copy ECC's definition over it manually if you want the bundled one.`
      );
    }
    adjusted.set(comparablePath(operation.destinationPath), {
      ...operation.mergePayload,
      mcpServers: servers,
    });
  }

  if (adjusted.size === 0) return plan;

  const rewrite = operation => {
    if (!isMcpServerMerge(operation)) return operation;
    const mergePayload = adjusted.get(comparablePath(operation.destinationPath));
    return mergePayload ? { ...operation, mergePayload } : operation;
  };
  // A payload with nothing left to manage is not an operation: claiming the
  // file in the ledger would let uninstall touch a file ECC never changed.
  const keep = operation => {
    if (!isMcpServerMerge(operation)) return true;
    const mergePayload = adjusted.get(comparablePath(operation.destinationPath));
    return !mergePayload
      || Object.keys(mergePayload.mcpServers).length > 0
      || Object.keys(mergePayload).length > 1;
  };
  const adjustOperations = operations => operations.map(rewrite).filter(keep);

  return {
    ...plan,
    operations: adjustOperations(plan.operations),
    ...(plan.statePreview && Array.isArray(plan.statePreview.operations)
      ? { statePreview: { ...plan.statePreview, operations: adjustOperations(plan.statePreview.operations) } }
      : {}),
    warnings: [...(Array.isArray(plan.warnings) ? plan.warnings : []), ...warnings],
  };
}

/**
 * Write-time recheck: refuse if a colliding user entry appeared after planning.
 */
function assertNoNewUserOwnedMcpServer(operation, previousOperation) {
  if (!isMcpServerMerge(operation)) return;
  const existing = readExistingServers(operation.destinationPath);
  if (existing === null) return;
  const conflicts = findUserOwnedServerConflicts(
    existing,
    operation.mergePayload.mcpServers,
    previousServersFor(previousOperation)
  );
  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to overwrite user MCP server ${conflicts.map(name => `"${name}"`).join(', ')} in ${operation.destinationPath}: it changed after planning. Rerun the installer to preserve it.`
    );
  }
}

module.exports = {
  assertNoNewUserOwnedMcpServer,
  comparablePath,
  findUserOwnedServerConflicts,
  isMcpServerMerge,
  mergeMcpConfig,
  withPreservedUserMcpServers,
};
