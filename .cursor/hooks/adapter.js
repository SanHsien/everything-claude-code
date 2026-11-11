#!/usr/bin/env node
/**
 * Cursor-to-Claude Code Hook Adapter
 * Transforms Cursor stdin JSON to Claude Code hook format,
 * then delegates to existing scripts/hooks/*.js
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_STDIN_BYTES = 1024 * 1024;
const STOP_FORMAT_TYPECHECK_BUDGET_MS = 210000;
const STOP_FORMAT_TYPECHECK_TIMEOUT_HEADROOM_MS = 15000;

function readStdin(options = {}) {
  return new Promise((resolve) => {
    const stream = options.stream || process.stdin;
    let data = '';
    let dataBytes = 0;
    let truncated = false;
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      const chunkBytes = Buffer.byteLength(chunk, 'utf8');
      if (truncated || dataBytes + chunkBytes > MAX_STDIN_BYTES) {
        truncated = true;
        return;
      }
      data += chunk;
      dataBytes += chunkBytes;
    });
    stream.on('end', () => {
      if (truncated) {
        if (options.includeMetadata !== true) {
          process.stderr.write(
            `[Cursor Hook] stdin exceeded ${MAX_STDIN_BYTES} bytes; suppressing truncated input\n`
          );
        }
        resolve(options.includeMetadata === true
          ? { raw: '', truncated: true, readError: false }
          : '');
        return;
      }
      resolve(options.includeMetadata === true
        ? { raw: data, truncated: false, readError: false }
        : data);
    });
    stream.on('error', error => {
      process.stderr.write(`[Cursor Hook] stdin read failed: ${error.message}\n`);
      resolve(options.includeMetadata === true
        ? { raw: '', truncated: false, readError: true }
        : '');
    });
  });
}

function getPluginRoot() {
  const candidates = [
    // Installed layout: <project>/.cursor/hooks -> <project>/.cursor/scripts.
    path.resolve(__dirname, '..'),
    // Repository layout: <repo>/.cursor/hooks -> <repo>/scripts.
    path.resolve(__dirname, '..', '..'),
  ];

  return candidates.find(candidate => (
    fs.existsSync(path.join(candidate, 'scripts', 'hooks'))
    && fs.existsSync(path.join(candidate, 'scripts', 'lib'))
  )) || candidates[0];
}

function resolveRuntimePath(...segments) {
  const runtimeRoot = getPluginRoot();
  const resolvedRoot = path.resolve(runtimeRoot);
  const resolvedPath = path.resolve(runtimeRoot, ...segments);
  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Cursor hook runtime path escapes its root: ${resolvedPath}`);
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Cursor hook runtime file not found: ${resolvedPath}`);
  }
  return resolvedPath;
}

function loadRuntimeModule(...segments) {
  return require(resolveRuntimePath(...segments));
}

function fallbackHookEnabled(hookId, allowedProfiles) {
  const enabled = String(process.env.ECC_HOOKS_ENABLED ?? 'true').trim().toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(enabled)) {
    return false;
  }

  const rawProfile = String(process.env.ECC_HOOK_PROFILE || 'standard').trim().toLowerCase();
  const profile = ['minimal', 'standard', 'strict'].includes(rawProfile)
    ? rawProfile
    : 'standard';
  const disabled = new Set(
    String(process.env.ECC_DISABLED_HOOKS || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );

  return !disabled.has(String(hookId || '').trim().toLowerCase())
    && allowedProfiles.includes(profile);
}

function transformToClaude(cursorInput, overrides = {}) {
  const cursorSessionId = cursorInput.conversation_id || cursorInput.session_id || '';
  return {
    tool_input: {
      command: cursorInput.command || cursorInput.args?.command || '',
      file_path: cursorInput.file_path || cursorInput.path || cursorInput.file || cursorInput.args?.filePath || '',
      ...overrides.tool_input,
    },
    tool_output: {
      output: cursorInput.output || cursorInput.result || '',
      ...overrides.tool_output,
    },
    transcript_path: cursorInput.transcript_path || cursorInput.transcriptPath || cursorInput.session?.transcript_path || '',
    session_id: cursorSessionId,
    _cursor: {
      conversation_id: cursorInput.conversation_id,
      hook_event_name: cursorInput.hook_event_name,
      workspace_roots: cursorInput.workspace_roots,
      model: cursorInput.model,
    },
  };
}

function normalizeSessionStartOutput(rawOutput, options = {}) {
  if (!rawOutput) return {};
  const parsed = JSON.parse(rawOutput);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return {
    ...(parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
      ? { env: parsed.env }
      : {}),
    ...(typeof parsed.additional_context === 'string' && parsed.additional_context
      ? { additional_context: parsed.additional_context }
      : {}),
    ...(options.shared === true
      && typeof parsed.hookSpecificOutput?.additionalContext === 'string'
      && parsed.hookSpecificOutput.additionalContext
      ? { additional_context: parsed.hookSpecificOutput.additionalContext }
      : {}),
  };
}

function mergeSessionStartOutputs(outputs) {
  const validOutputs = outputs.filter(output => output && typeof output === 'object');
  const env = Object.assign({}, ...validOutputs.map(output => output.env || {}));
  const additionalContext = validOutputs
    .map(output => output.additional_context)
    .filter(Boolean)
    .join('\n\n');

  return {
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(additionalContext ? { additional_context: additionalContext } : {}),
  };
}

function createStopFormatTypecheckOptions(sessionEnv = {}) {
  return {
    timeout: STOP_FORMAT_TYPECHECK_BUDGET_MS + STOP_FORMAT_TYPECHECK_TIMEOUT_HEADROOM_MS,
    forwardStderr: true,
    env: {
      ...sessionEnv,
      ECC_STOP_FORMAT_TYPECHECK_BUDGET_MS: String(STOP_FORMAT_TYPECHECK_BUDGET_MS),
    },
  };
}

// ECC_CURSOR_HOOK_TIMEOUT_MS lets a slow machine (or a test) change the default
// 15 s budget of a delegated hook; an explicit options.timeout still wins.
function resolveHookTimeout(options) {
  if (options.timeout) return options.timeout;
  const fromEnv = Number(process.env.ECC_CURSOR_HOOK_TIMEOUT_MS);
  return Number.isSafeInteger(fromEnv) && fromEnv > 0 ? fromEnv : 15000;
}

// `options.failClosed`: this hook is a security guard. Cursor denies a command
// on exit code 2 and treats every other failure as "continue", so a guard that
// cannot run to a decision (missing script, spawn error, timeout, signal,
// crash) must itself exit 2 instead of being logged and skipped.
function failClosedExit(scriptName, reason) {
  process.stderr.write(
    `[Cursor Hook] BLOCKED: ${scriptName} could not complete its check (${reason}). `
    + 'Failing closed. Fix the hook, or disable it explicitly (ECC_DISABLED_HOOKS) to proceed.\n'
  );
  process.exit(2);
}

function runExistingHook(scriptName, stdinData, options = {}) {
  try {
    const scriptPath = resolveRuntimePath('scripts', 'hooks', scriptName);
    let cursorSessionId = '';
    try {
      const input = typeof stdinData === 'string' ? JSON.parse(stdinData) : stdinData;
      cursorSessionId = input?._cursor?.conversation_id
        || input?.conversation_id
        || input?.session_id
        || '';
    } catch {
      // Raw non-JSON hook input has no session identifier to propagate.
    }
    const result = spawnSync(process.execPath, [scriptPath], {
      input: typeof stdinData === 'string' ? stdinData : JSON.stringify(stdinData),
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(options.env || {}),
        ...(cursorSessionId
          ? { CLAUDE_SESSION_ID: String(cursorSessionId) }
          : {}),
      },
      timeout: resolveHookTimeout(options),
      cwd: process.cwd(),
    });

    if (result.stderr && (result.status === 2 || options.forwardStderr === true)) {
      process.stderr.write(result.stderr);
    }
    if (result.status === 2) {
      process.exit(2);
    }
    if (result.error || result.signal || result.status === null) {
      const reason = result.error
        ? result.error.message
        : result.signal
          ? `signal ${result.signal}`
          : 'missing exit status';
      process.stderr.write(`[Cursor Hook] ${scriptName} failed: ${reason}\n`);
      if (options.failClosed === true) failClosedExit(scriptName, reason);
    } else if (Number.isInteger(result.status) && result.status !== 0) {
      if (options.failClosed === true) failClosedExit(scriptName, `exited with code ${result.status}`);
      process.stderr.write(
        `[Cursor Hook] ${scriptName} exited with code ${result.status}; continuing\n`
      );
    }
    return result;
  } catch (error) {
    process.stderr.write(`[Cursor Hook] ${scriptName} skipped: ${error.message}\n`);
    if (options.failClosed === true) failClosedExit(scriptName, error.message);
    return null;
  }
}

function hookEnabled(hookId, allowedProfiles = ['standard', 'strict']) {
  try {
    const { isHookEnabled } = loadRuntimeModule('scripts', 'lib', 'hook-flags.js');
    return isHookEnabled(hookId, { profiles: allowedProfiles });
  } catch {
    // Keep native Cursor checks controllable in partial or manually copied installs.
    return fallbackHookEnabled(hookId, allowedProfiles);
  }
}

module.exports = {
  readStdin,
  getPluginRoot,
  resolveRuntimePath,
  loadRuntimeModule,
  fallbackHookEnabled,
  transformToClaude,
  normalizeSessionStartOutput,
  mergeSessionStartOutputs,
  createStopFormatTypecheckOptions,
  runExistingHook,
  hookEnabled,
};
