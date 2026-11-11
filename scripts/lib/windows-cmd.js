'use strict';

/**
 * Fork-owned: run a Windows `.cmd`/`.bat` shim without `shell: true`.
 *
 * `spawnSync(shim, argsArray, { shell: true })` does not quote the array, so a
 * path such as `C:\Users\John Doe\app\two words.js` reaches the shim as several
 * arguments (and Node warns DEP0190). The earlier workaround was to refuse any
 * path containing whitespace or cmd metacharacters, which silently skipped
 * formatting for ordinary Windows profile directories.
 *
 * Here every token (the shim and each argument) travels in its own environment
 * variable and the command line only contains quoted `%NAME%` references:
 *  - values never become cmd.exe source, so `& | < > ^ ( ) ! ;` stay literal;
 *  - percent expansion is single-pass, so a `%` inside a value is not expanded
 *    again, and `/v:off` keeps `!` literal;
 *  - a value is rejected only when it could break out of the quoted token:
 *    a double quote, NUL, CR or LF (none of which can appear in a Windows path).
 */

const CMD_TOKEN_ENV_PREFIX = 'ECC_CMD_TOKEN_';
const UNSAFE_CMD_TOKEN = /["\0\r\n]/;

function isWindowsCmdShim(command, platform = process.platform) {
  return platform === 'win32' && /\.(?:cmd|bat)$/i.test(String(command || ''));
}

function validateCmdToken(value) {
  const token = String(value);
  if (UNSAFE_CMD_TOKEN.test(token)) {
    throw new Error(`Unsafe character in Windows command argument: ${JSON.stringify(token)}`);
  }
  return token;
}

/**
 * @param {string} command Shim path (`.cmd`/`.bat`).
 * @param {string[]} args Arguments, passed verbatim.
 * @param {object} [options] spawnSync options to carry over (cwd, timeout, stdio, ...).
 * @returns {{ command: string, args: string[], options: object }} Arguments for
 *   `spawnSync(command, args, options)`; never uses a shell.
 */
function buildCmdShimInvocation(command, args = [], options = {}) {
  const environment = { ...(options.env || process.env) };
  for (const name of Object.keys(environment)) {
    if (name.toUpperCase().startsWith(CMD_TOKEN_ENV_PREFIX)) {
      delete environment[name];
    }
  }

  const references = [command, ...args].map((value, index) => {
    const name = `${CMD_TOKEN_ENV_PREFIX}${index}`;
    environment[name] = validateCmdToken(value);
    return `"%${name}%"`;
  });

  return {
    command: process.env.ComSpec || process.env.COMSPEC || 'cmd.exe',
    args: ['/d', '/v:off', '/s', '/c', `"${references.join(' ')}"`],
    options: {
      ...options,
      shell: false,
      windowsVerbatimArguments: true,
      env: environment,
    },
  };
}

module.exports = {
  CMD_TOKEN_ENV_PREFIX,
  buildCmdShimInvocation,
  isWindowsCmdShim,
};
