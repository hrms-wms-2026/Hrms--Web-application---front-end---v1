#!/usr/bin/env node
/**
 * Prompts for a SendGrid API key at the terminal (input is masked) and writes it to
 * `.env.local` in the repo root as SENDGRID_API_KEY=... . That file is gitignored - the key
 * never gets typed into a tracked file or pasted into chat.
 *
 * Usage: node scripts/set-sendgrid-key.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const KEY_NAME = 'SENDGRID_API_KEY';

function promptMasked(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);

    let value = '';
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      switch (char) {
        case '\n':
        case '\r':
        case '': // Ctrl-D
          stdin.setRawMode(wasRaw ?? false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          break;
        case '': // Ctrl-C
          process.stdout.write('\n');
          process.exit(130);
          break;
        case '': // Backspace
        case '\b':
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          value += char;
          process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  const key = (await promptMasked('Enter your SendGrid API key: ')).trim();

  if (!key) {
    console.error('No key entered - nothing written.');
    process.exitCode = 1;
    return;
  }
  if (!key.startsWith('SG.')) {
    console.warn('Warning: SendGrid API keys normally start with "SG." - double-check this is the right value.');
  }

  const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const lines = existing.split('\n').filter((line) => line.trim().length > 0 && !line.startsWith(`${KEY_NAME}=`));
  lines.push(`${KEY_NAME}=${key}`);
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { mode: 0o600 });

  console.log(`Saved to ${path.relative(process.cwd(), ENV_FILE)} (gitignored, never committed).`);
}

main();
