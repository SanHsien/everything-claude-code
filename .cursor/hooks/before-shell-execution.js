#!/usr/bin/env node
const {
  readStdin,
  hookEnabled,
  runExistingHook,
  transformToClaude,
} = require('./adapter');

function hasBlockingGuard() {
  return hookEnabled('pre:bash:block-no-verify', ['minimal', 'standard', 'strict'])
    || (
      process.platform !== 'win32'
      && hookEnabled('pre:bash:dev-server-block', ['standard', 'strict'])
    );
}

// Cursor denies on exit code 2 and continues on anything else, so a failure of
// an enabled blocking guard has to turn into exit 2 here.
function failClosed(reason) {
  console.error(`[Cursor Hook] BLOCKED: beforeShellExecution guard failed (${reason}). Failing closed.`);
  process.exit(2);
}

readStdin({ includeMetadata: true })
  .then(({ raw, truncated, readError }) => {
    if (truncated || readError) {
      if (hasBlockingGuard()) {
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
        input = JSON.parse(raw || '{}');
        cmd = String(input.command || input.args?.command || '');
      } catch {
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
        runExistingHook('pre-bash-dev-server-block.js', claudeRaw, { failClosed: true });
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
      if (hasBlockingGuard()) failClosed(error.message);
    }

    process.stdout.write(raw);
  })
  .catch(error => {
    if (hasBlockingGuard()) failClosed(error && error.message);
    process.exit(0);
  });
