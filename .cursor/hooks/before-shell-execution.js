#!/usr/bin/env node
const {
  readStdin,
  hookEnabled,
  runExistingHook,
  transformToClaude,
} = require('./adapter');

// Only block-no-verify is a security control. The dev-server guard is a
// workflow nudge (it also exits 2 to refuse a command, but a failure of the
// guard itself must not stop unrelated shell commands), so it stays fail-open.
function hasSecurityGuard() {
  return hookEnabled('pre:bash:block-no-verify', ['minimal', 'standard', 'strict']);
}

// Cursor denies on exit code 2 and continues on anything else, so a failure of
// an enabled security guard has to turn into exit 2 here.
function failClosed(reason) {
  console.error(`[Cursor Hook] BLOCKED: beforeShellExecution guard failed (${reason}). Failing closed.`);
  process.exit(2);
}

readStdin({ includeMetadata: true })
  .then(({ raw, truncated, readError }) => {
    if (truncated || readError) {
      if (hasSecurityGuard()) {
        console.error(truncated
          ? '[Cursor Hook] stdin exceeded the safety limit; blocking beforeShellExecution'
          : '[Cursor Hook] stdin read failed; blocking beforeShellExecution');
        process.exit(2);
      }
      console.error(truncated
        ? '[Cursor Hook] stdin exceeded the safety limit; suppressing truncated input'
        : '[Cursor Hook] stdin read failed; suppressing untrusted input');
      return;
    }

    try {
      let input;
      let cmd;
      try {
        input = JSON.parse(raw);
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new TypeError('hook input is not a JSON object');
        }
        cmd = String(input.command || input.args?.command || '');
      } catch (error) {
        // The guards cannot inspect a request they cannot parse (the Claude Code
        // path blocks on this too); with no guard enabled it is only logged.
        if (hasSecurityGuard()) failClosed(`stdin is unusable: ${error.message}`);
        input = {};
        cmd = String(raw || '');
      }
      const claudeInput = transformToClaude(input, {
        tool_input: { command: cmd },
      });
      const claudeRaw = JSON.stringify(claudeInput);

      // Cursor may execute only the first hook registered for an event. Keep
      // every blocking shell guard behind this single event-level dispatcher.
      if (hookEnabled('pre:bash:block-no-verify', ['minimal', 'standard', 'strict'])) {
        runExistingHook('block-no-verify.js', claudeRaw, { failClosed: true });
      }

      if (hookEnabled('pre:bash:dev-server-block', ['standard', 'strict']) && process.platform !== 'win32') {
        runExistingHook('pre-bash-dev-server-block.js', claudeRaw);
      }

      if (
        hookEnabled('pre:bash:tmux-reminder', ['strict']) &&
        process.platform !== 'win32' &&
        !process.env.TMUX &&
        /(npm (install|test)|pnpm (install|test)|yarn (install|test)?|bun (install|test)|cargo build|make\b|docker\b|pytest|vitest|playwright)/.test(cmd)
      ) {
        console.error('[ECC] Consider running in tmux for session persistence');
      }

      if (hookEnabled('pre:bash:git-push-reminder', ['strict']) && /\bgit\s+push\b/.test(cmd)) {
        console.error('[ECC] Review changes before push: git diff origin/main...HEAD');
      }
    } catch (error) {
      if (hasSecurityGuard()) failClosed(error.message);
    }

    process.stdout.write(raw);
  })
  .catch(error => {
    if (hasSecurityGuard()) failClosed(error && error.message);
    process.exit(0);
  });
