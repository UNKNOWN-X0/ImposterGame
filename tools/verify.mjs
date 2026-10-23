/**
 * Everything that can be checked, in one command.
 *
 *   npm run verify
 *
 * This exists because the project had four ways of checking itself and no
 * way of running them. `npm test` was the only one anybody typed, and the two
 * checks that have actually caught shipped crashes — the browser sweeps —
 * needed a build, a browser, and remembering they existed.
 *
 * The rule here: a check that cannot run is skipped out loud, and a check
 * that runs and fails stops the lot. Not having a browser installed is not a
 * failure, because the game needs nothing but React to run; it is a smaller
 * verification, and the summary says so rather than quietly printing green.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const results = [];

function run(name, command, args) {
  process.stdout.write(`\n── ${name} ──\n`);
  const started = Date.now();
  const { status } = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  const took = ((Date.now() - started) / 1000).toFixed(1);
  // A harness exits 2 when it cannot run at all, which is a skip, not a fail.
  const how = status === 0 ? 'ok' : status === 2 ? 'skipped' : 'failed';
  results.push({ name, how, took });
  return how;
}

function skip(name, why) {
  process.stdout.write(`\n── ${name} ──\n${why}\n`);
  results.push({ name, how: 'skipped', took: '0.0' });
}

/* 1. The tests. Always available: the game depends on React and nothing else. */
run('unit tests', npm, ['test']);

/* 2. The same tests again, watching which modules they never reach.
 *
 * This runs the suite a second time, which is a few seconds well spent: a
 * module can be green and untouched at once, and that is exactly how modes/
 * reached 1,490 lines with nothing on it.
 */
run('coverage', npm, ['run', 'coverage']);

/* 3. The build, and the two sweeps that need one.
 *
 * Without dev dependencies there is no bundler, so there is nothing to put in
 * a browser — that is a smaller check, not a broken one. A bundler that is
 * present and fails, on the other hand, is exactly what this is for.
 */
const canBuild = existsSync(path.join(root, 'node_modules', 'vite'));
let built = false;

if (!canBuild) {
  skip('build', 'No dev dependencies installed, so there is nothing to build.\nRun `npm install` to include the build and the browser sweeps.');
} else {
  built = run('build', npm, ['run', 'build']) === 'ok';
}

let hasBrowser = false;
try {
  await import('playwright');
  hasBrowser = true;
} catch {
  hasBrowser = false;
}

const browserWhy = !built
  ? 'Needs a build first.'
  : 'No browser installed. These two drive the real UI, which needs one:\n' +
    '  npm install --no-save playwright && npx playwright install chromium\n' +
    '`npm test` needs none of this.';

for (const [name, script] of [
  ['every screen', 'screens'],
  ['every ending', 'endings'],
]) {
  if (built && hasBrowser) run(name, npm, ['run', script]);
  else skip(name, browserWhy);
}

/* 4. What happened. */
const mark = { ok: '✓', skipped: '–', failed: '✗' };
const failed = results.filter((r) => r.how === 'failed');
const skipped = results.filter((r) => r.how === 'skipped');

process.stdout.write('\n── verify ──\n');
for (const r of results) {
  process.stdout.write(`  ${mark[r.how]} ${r.name.padEnd(14)} ${r.how.padEnd(8)} ${r.took}s\n`);
}

if (failed.length) {
  process.stdout.write(`\n${failed.length} check(s) failed.\n`);
  process.exit(1);
}
if (skipped.length) {
  process.stdout.write(
    `\nPassed, but ${skipped.length} check(s) could not run — this was a smaller verification than it looks.\n`,
  );
} else {
  process.stdout.write('\nAll checks passed.\n');
}
