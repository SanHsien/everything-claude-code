#!/usr/bin/env node
'use strict';

const { readStdinRaw, resolveMaxStdin } = require('./hook-input');
const { isHookEnabled } = require('../lib/hook-flags');
const { hasActivePreBashSafetyHook, safetyBlock } = require('./safety-hooks');

const maxStdin = resolveMaxStdin(process.env.ECC_HOOK_INPUT_MAX_BYTES, {
  writeDiagnostic: message => process.stderr.write(message)
});

readStdinRaw(process.stdin, {
  maxStdin,
  truncated: /^(1|true|yes)$/i.test(
    String(process.env.ECC_HOOK_INPUT_TRUNCATED_UPSTREAM || '')
  )
}).then(({ raw, truncated }) => {
  if (!isHookEnabled('pre:bash:dispatcher', {
    profiles: 'minimal,standard,strict'
  })) {
    process.exitCode = 0;
    return;
  }

  // When every security sub-hook has been switched off by the user the
  // dispatcher only has reminders and helpers left, so an oversized request or
  // a sub-hook that cannot load is not a reason to block.
  if (truncated) {
    if (!hasActivePreBashSafetyHook()) {
      process.stderr.write(
        `[Hook] stdin exceeded ${maxStdin} bytes for pre:bash:dispatcher; no security sub-hook is enabled, skipping\n`
      );
      process.exitCode = 0;
      return;
    }
    process.stderr.write(
      `[Hook] stdin exceeded ${maxStdin} bytes for pre:bash:dispatcher; blocking because safety checks require the complete request\n`
    );
    process.exitCode = 2;
    return;
  }

  // Load the sub-hooks only now, after the opt-out checks above.
  let runPreBash;
  try {
    ({ runPreBash } = require('./bash-hook-dispatcher'));
  } catch (error) {
    if (!hasActivePreBashSafetyHook()) {
      process.stderr.write(
        `[Hook] pre-bash dispatcher could not load (${error.message}); no security sub-hook is enabled, skipping\n`
      );
      process.exitCode = 0;
      return;
    }
    process.stderr.write(
      `${safetyBlock('pre:bash:dispatcher', `dispatcher could not load: ${error.message}`).stderr}\n`
    );
    process.exitCode = 2;
    return;
  }

  const result = runPreBash(raw);
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.stdout.write(result.output);
  process.exitCode = result.exitCode;
}).catch(error => {
  process.stderr.write(`[Hook] pre-bash dispatcher failed: ${error.message}\n`);
  process.exitCode = hasActivePreBashSafetyHook() ? 2 : 0;
});
