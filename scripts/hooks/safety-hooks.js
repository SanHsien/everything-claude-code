'use strict';

/**
 * Fail-closed policy for security hooks (fork-owned module).
 *
 * Claude Code hook protocol: on PreToolUse, exit code 2 blocks the tool call
 * and feeds stderr back to the model. Exit 0 allows. Any other non-zero exit
 * is a *non-blocking* error, so the tool call still runs. A security hook that
 * cannot finish its check (unparsable input, missing module, thrown error,
 * spawn failure, timeout, signal) must therefore exit 2, never 0 or 1.
 *
 * Only hooks that enforce a security boundary are listed here. Reminders,
 * loggers, formatters and quality warnings keep their non-interrupting
 * behaviour: a failure in them must not stop the user's work.
 */

const { isBenignStdinPipeError } = require('./hook-input');

/** Hook ids that enforce a security boundary on PreToolUse. */
const GATEGUARD_HOOK_IDS = Object.freeze([
  'pre:bash:gateguard-fact-force',
  'pre:powershell:gateguard-fact-force',
  'pre:edit-write:gateguard-fact-force'
]);

const SAFETY_HOOK_IDS = Object.freeze(new Set([
  ...GATEGUARD_HOOK_IDS,
  'pre:bash:block-no-verify',
  'pre:config-protection'
]));

/** Entry-point scripts (relative to the plugin root) that run safety hooks. */
const PRE_BASH_DISPATCHER_REL = 'scripts/hooks/pre-bash-dispatcher.js';
const RUN_WITH_FLAGS_REL = 'scripts/hooks/run-with-flags.js';

const GATEGUARD_OFF_VALUES = new Set(['0', 'false', 'off', 'disabled', 'disable']);

function isGateGuardDisabledByEnv(env = process.env) {
  if (String(env.GATEGUARD_DISABLED || '').trim() === '1') return true;
  return GATEGUARD_OFF_VALUES.has(String(env.ECC_GATEGUARD || '').trim().toLowerCase());
}

/**
 * True when `hookId` is a security hook that is not switched off by its own
 * dedicated opt-out. Callers have already checked profile / ECC_DISABLED_HOOKS
 * via isHookEnabled.
 */
function isSafetyHookActive(hookId, env = process.env) {
  if (typeof hookId !== 'string' || !SAFETY_HOOK_IDS.has(hookId)) return false;
  if (GATEGUARD_HOOK_IDS.includes(hookId) && isGateGuardDisabledByEnv(env)) return false;
  return true;
}

function normalizeRel(relPath) {
  return String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Does this bootstrap invocation (relPath + args) run a security hook? */
function isSafetyEntrypoint(relPath, args = []) {
  const rel = normalizeRel(relPath);
  if (rel === PRE_BASH_DISPATCHER_REL) return true;
  if (rel === RUN_WITH_FLAGS_REL) return isSafetyHookActive(args[0]);
  return false;
}

/**
 * Why the request cannot be inspected, or null when it is a well-formed hook
 * event. Security hooks need a complete JSON object; anything else means the
 * check cannot be performed.
 */
function payloadProblem(raw) {
  const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : '';
  if (!text.trim()) return 'hook input was empty';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return `hook input is not complete JSON (${error.message})`;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'hook input is not a JSON object';
  }
  if (parsed.tool_name !== undefined && typeof parsed.tool_name !== 'string') {
    return 'hook input has a non-string tool_name';
  }
  return null;
}

function safetyBlock(hookId, detail) {
  const reason = String(detail || 'unknown failure').replace(/\s+/g, ' ').trim();
  return {
    stdout: '',
    stderr: `BLOCKED: security hook ${hookId || 'unknown'} could not complete its check (${reason}). ` +
      'Failing closed. Fix the hook, or disable it explicitly (ECC_DISABLED_HOOKS) to proceed.',
    exitCode: 2
  };
}

/**
 * Map a spawnSync-style result from a security hook to its final verdict.
 * Only the child's own exit 0 (allow) or exit 2 (block) is trusted; a spawn
 * error, timeout, signal, missing status, or any other exit code means the
 * check did not run to a decision.
 */
function resolveSafetyExit(result, hookId = 'security hook') {
  const benign = isBenignStdinPipeError(result);
  if (!benign && result && (result.error || result.signal || result.status === null || result.status === undefined)) {
    const detail = result.error
      ? result.error.message
      : result.signal
        ? `terminated by signal ${result.signal}`
        : 'missing exit status';
    return safetyBlock(hookId, detail);
  }
  if (!result) return safetyBlock(hookId, 'no result');
  if (result.status === 0 || result.status === 2) {
    return { stdout: '', stderr: '', exitCode: result.status };
  }
  return safetyBlock(hookId, `exited with status ${result.status}`);
}

module.exports = {
  GATEGUARD_HOOK_IDS,
  SAFETY_HOOK_IDS,
  isGateGuardDisabledByEnv,
  isSafetyEntrypoint,
  isSafetyHookActive,
  payloadProblem,
  resolveSafetyExit,
  safetyBlock
};
