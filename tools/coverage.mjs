/**
 * Coverage, per module, with a floor under each one.
 *
 *   npm run coverage             measure, print the table, fail under a floor
 *   npm run coverage -- --bless  raise the floors to what the code manages now
 *
 * This is not here to chase a number. It is here because `modes/` grew to
 * 1,490 lines with no tests at all and nothing ever said so — the suite was
 * green the whole time, because a module with no tests has nothing to fail.
 *
 * Two things this does that a plain coverage run does not:
 *
 *  - A file no test ever loads counts as zero, rather than vanishing. Node
 *    only reports files that were imported, so the module with no tests is
 *    precisely the one that disappears from its own report. Every .js file
 *    on disk is in the table below whether a test touched it or not.
 *  - .jsx is left out of the percentage instead of being scored as zero.
 *    `node --test` has no JSX transform, so those files cannot be measured
 *    here at all; they are checked by `npm run screens` and `npm run endings`
 *    in a real browser. The table counts them separately so the number above
 *    is not quietly standing in for them.
 *
 * The floors in src/testing/coverage.floors.json are a ratchet: they start at
 * what each module already manages, and `--bless` raises them after you have
 * added tests. Nothing lowers them automatically.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const floorsFile = path.join(root, 'src', 'testing', 'coverage.floors.json');

/** Which folder a file belongs to. Order matters: first match wins. */
const MODULES = [
  ['core', 'src/core/'],
  ['content', 'src/content/'],
  ['i18n', 'src/i18n/'],
  ['ui', 'src/ui/'],
  ['features', 'src/features/'],
  ['modes', 'src/modes/'],
  ['testing', 'src/testing/'],
  ['server', 'server/'],
  ['app', 'src/'], // App.jsx, main.jsx — whatever sits at the top
];

const moduleOf = (file) => MODULES.find(([, prefix]) => file.startsWith(prefix))?.[0] ?? null;

const isTest = (file) => /\.test\.js$/.test(file);

/**
 * Does this file need React to do anything?
 *
 * `.jsx` is the obvious case, but a hook is React too and often has no JSX in
 * it at all — `useWords.js` and `useRoom.js` are both plain `.js`. Node can
 * import them, so they show up in a coverage report; what it cannot do is
 * render a component or run an effect, so the only honest number for them is
 * the one the browser sweeps produce. Counting them here would mean a module
 * that grows a hook gets a worse score for it, which teaches exactly the
 * wrong lesson.
 */
const needsReact = (file) =>
  /\.jsx$/.test(file) ||
  /^\s*import[^;]*from\s+'react(-dom)?(\/[\w.]+)?'/m.test(
    readFileSync(path.join(root, file), 'utf8'),
  );
/** The browser harnesses run a browser; they are not units and never will be. */
const isHarness = (file) => file.startsWith('src/testing/browser/');

/** Every source file on disk, whether or not a test has ever heard of it. */
function sources(dir, found = []) {
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) sources(rel, found);
    else if (/\.(js|jsx)$/.test(entry.name) && !isTest(rel) && !isHarness(rel)) found.push(rel);
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * Measure
 * ------------------------------------------------------------------ */

const out = path.join(mkdtempSync(path.join(tmpdir(), 'imposter-cov-')), 'lcov.info');

const { status, error } = spawnSync(
  process.execPath,
  [
    '--test',
    '--experimental-test-coverage',
    '--test-reporter=lcov',
    `--test-reporter-destination=${out}`,
    '--test-reporter=dot',
    '--test-reporter-destination=stdout',
    'src/**/*.test.js',
    'server/**/*.test.js',
  ],
  { cwd: root, stdio: 'inherit' },
);

if (error) {
  console.error(error.message);
  process.exit(1);
}
if (status !== 0) {
  console.error('\nThe tests failed, so coverage would be measuring the wrong thing.');
  process.exit(status ?? 1);
}
if (!existsSync(out)) {
  console.error('\nNo coverage was written. This needs Node 22 or newer.');
  process.exit(2);
}

/* ------------------------------------------------------------------ *
 * Read the lcov: SF is a file, LF lines found, LH lines hit
 * ------------------------------------------------------------------ */

const measured = new Map(); // file -> { found, hit }
let file = null;

for (const line of readFileSync(out, 'utf8').split('\n')) {
  if (line.startsWith('SF:')) {
    file = path.relative(root, line.slice(3).trim()).split(path.sep).join('/');
    if (isTest(file) || file.startsWith('tools/')) file = null;
    else if (file && !measured.has(file)) measured.set(file, { found: 0, hit: 0 });
  } else if (file && line.startsWith('LF:')) {
    measured.get(file).found += Number(line.slice(3));
  } else if (file && line.startsWith('LH:')) {
    measured.get(file).hit += Number(line.slice(3));
  }
}

/* ------------------------------------------------------------------ *
 * Fold in the files nothing loaded, which are the point of the exercise
 * ------------------------------------------------------------------ */

const totals = new Map();
const untouched = [];

for (const rel of sources('src').concat(sources('server'))) {
  const name = moduleOf(rel);
  if (!name) continue;
  const row =
    totals.get(name) ?? { found: 0, hit: 0, jsx: 0, jsxFiles: 0, files: 0, cold: 0 };
  totals.set(name, row);

  if (needsReact(rel)) {
    // Out of reach of `node --test`; the browser sweeps cover these.
    row.jsx += readFileSync(path.join(root, rel), 'utf8').split('\n').length;
    row.jsxFiles += 1;
    continue;
  }

  row.files += 1;
  const hit = measured.get(rel);
  if (hit) {
    row.found += hit.found;
    row.hit += hit.hit;
  } else {
    // Never imported by any test. Node says nothing about it at all, so it
    // would otherwise be missing from its own module's score.
    row.found += readFileSync(path.join(root, rel), 'utf8').split('\n').length;
    row.cold += 1;
    untouched.push(rel);
  }
}

const pct = (hit, found) => (found === 0 ? 100 : (hit / found) * 100);

/* ------------------------------------------------------------------ *
 * Compare with the floors
 * ------------------------------------------------------------------ */

const floors = existsSync(floorsFile) ? JSON.parse(readFileSync(floorsFile, 'utf8')) : {};
const order = MODULES.map(([name]) => name).filter((name) => totals.get(name)?.files);

if (process.argv.includes('--bless')) {
  // A ratchet only turns one way. Without this, running --bless after a
  // change that happened to lower coverage quietly writes the lower number
  // down as the new standard, and the floor follows the code downhill
  // instead of holding it up. `--lower` says you meant it.
  const allowLower = process.argv.includes('--lower');
  const next = { ...floors };
  const lowered = [];
  for (const name of order) {
    const row = totals.get(name);
    // One whole point of slack below what it manages today. Without it a
    // module sitting at 100% fails the moment somebody adds a line, which
    // teaches people to re-bless on reflex — and a floor that is re-blessed
    // on reflex is not a floor.
    const want = Math.max(0, Math.floor(pct(row.hit, row.found)) - 1);
    const had = floors[name] ?? 0;
    if (want < had && !allowLower) {
      lowered.push(`${name} (${had}% → ${want}%)`);
      continue;
    }
    next[name] = want;
  }
  if (lowered.length) {
    console.log(`\n  Left alone, because a floor does not go down by itself: ${lowered.join(', ')}`);
    console.log('  If you meant it: npm run coverage -- --bless --lower');
  }
  writeFileSync(floorsFile, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nFloors raised to what the code manages now:`);
  for (const name of order) console.log(`  ${name.padEnd(9)} ${String(next[name]).padStart(3)}%`);
  process.exit(0);
}

const bar = (p) => '█'.repeat(Math.round(p / 5)).padEnd(20, '·');
const under = [];

console.log(
  '\n── coverage by module ──  (anything needing React is the browser sweeps’ job)\n',
);
console.log(
  `  ${'module'.padEnd(9)} ${'lines'.padStart(12)} ${'now'.padStart(6)} ${'floor'.padStart(6)}`,
);

for (const name of order) {
  const row = totals.get(name);
  const now = pct(row.hit, row.found);
  const floor = floors[name] ?? 0;
  const ok = now + 0.0001 >= floor;
  if (!ok) under.push({ name, now, floor });

  const notes = [];
  if (row.cold) notes.push(`${row.cold} file${row.cold > 1 ? 's' : ''} no test loads`);
  if (row.jsxFiles) notes.push(`+${row.jsx} React lines in a browser`);
  if (!floor) notes.push('no floor yet');

  console.log(
    `  ${name.padEnd(9)} ${`${row.hit}/${row.found}`.padStart(12)} ${now.toFixed(1).padStart(5)}% ` +
      `${String(floor).padStart(5)}% ${bar(now)}${notes.length ? `  ${notes.join(', ')}` : ''}`,
  );
}

const all = order.reduce(
  (acc, name) => {
    const r = totals.get(name);
    return { hit: acc.hit + r.hit, found: acc.found + r.found };
  },
  { hit: 0, found: 0 },
);
console.log(
  `\n  ${'all'.padEnd(9)} ${`${all.hit}/${all.found}`.padStart(12)} ${pct(all.hit, all.found).toFixed(1).padStart(5)}%`,
);

if (untouched.length) {
  console.log('\n  Files no test has ever loaded:');
  for (const f of untouched.slice(0, 12)) console.log(`    ${f}`);
  if (untouched.length > 12) console.log(`    … and ${untouched.length - 12} more`);
}

if (under.length) {
  console.log('\nCoverage fell below the floor:');
  for (const u of under) console.log(`  ${u.name}: ${u.now.toFixed(1)}%, floor ${u.floor}%`);
  console.log('\nAdd a test, or lower it deliberately and say why in the commit.');
  process.exit(1);
}

console.log('\nEvery module is at or above its floor.\n');
