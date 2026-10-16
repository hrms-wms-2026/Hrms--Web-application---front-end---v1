// Runs a production build and fails if the Angular CLI prints any warning or error.
// Used by the pre-push hook (.githooks/pre-push) and `npm run check:warnings`.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx ng build', {
  encoding: 'utf8',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
const problems = output
  .split(/\r?\n/)
  .filter((line) => /\[(WARNING|ERROR)\]/.test(line));

if (result.status !== 0 || problems.length > 0) {
  console.error(output);
  console.error(`\n✖ Build produced ${problems.length} warning(s)/error(s) (exit code ${result.status}).`);
  console.error('  Fix them before pushing. See "Zero warnings" in CLAUDE.md.');
  process.exit(1);
}

console.log('✔ Build is clean: no warnings, no errors.');
