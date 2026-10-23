/**
 * The three languages, against each other and against the code.
 *
 * Two failures are easy to ship and hard to notice. A screen can ask for a
 * key nobody wrote, and English is the fallback for everything, so a missing
 * Thai string shows an English sentence in the middle of a Thai game — which
 * looks like a translation nobody got round to rather than a bug.
 *
 * Both are findable by reading, so they are read here rather than waited for.
 */

import { readFileSync } from 'node:fs';

import { stripNonCode, sourceFiles } from './names.js';

/** Every key a file asks for by a literal — `t('settings.packs')`. */
export function keysAskedFor(file) {
  const code = readFileSync(file, 'utf8');
  const out = new Set();
  for (const [, key] of code.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) out.add(key);
  for (const [, key] of code.matchAll(/\berrorText\(\s*\{\s*code:\s*'(\w+)'/g)) out.add(`errors.${key}`);
  return out;
}

/** The keys every screen in the project asks for, and where each was asked. */
export function askedKeys(root) {
  const asked = new Map();
  for (const file of sourceFiles(root)) {
    if (file.endsWith('.test.js')) continue;
    for (const key of keysAskedFor(file)) {
      if (!asked.has(key)) asked.set(key, []);
      asked.get(key).push(file);
    }
  }
  return asked;
}

/**
 * Does a table answer this key?
 *
 * A counted string is stored as `key_one` / `key_other` and asked for as
 * `key`, so both spellings count as an answer.
 */
export const answers = (table, key) =>
  Boolean(table[key] || table[`${key}_other`] || table[`${key}_one`]);

/** Keys asked for by name that are built rather than written down. */
const BUILT_AT_RUNTIME = [
  /^log\./, // release notes, assembled from the changelog data
  /^rules\.\d/, // the four numbered steps
  /^packs\.skipped\./, // the reason a pasted line was skipped
  /^role\./, // a role's name, from the registry
  /^step\./, // the phase stepper
  /^theme\./, // the colour families
  /^result\./, // how a game ended
  /^errors\./, // a rule violation, by code
  /^settings\./, // a setting and its options
  /^hint\./,
  /^vote\./,
  /^reveal\./,
  /^home\./,
];

export const isBuiltAtRuntime = (key) => BUILT_AT_RUNTIME.some((p) => p.test(key));

// Comparing one language with another moved to ../../i18n/compare.js, so
// that the translator's screen can ask the same questions without importing
// a file that reads the filesystem. Re-exported here so the checks that used
// to find them here still do.
export { placeholdersIn, placeholderTrouble, readsAsUntranslated } from '../../i18n/compare.js';

/* ------------------------------------------------------------------ *
 * Keys nothing asks for
 * ------------------------------------------------------------------ */

/**
 * Every key-shaped string literal in a file, wherever it appears.
 *
 * Not just the ones handed straight to the reader: a key is just as alive
 * sitting in a lookup table —
 * `RoleGlyph.jsx` keeps `{ crew: 'reveal.crew', … }` and hands the value to
 * `t` somewhere else entirely. Matching only the call site would report
 * those as dead and somebody would delete a string a player sees.
 *
 * So anything shaped like a key counts. That is deliberately generous: the
 * cost of a false "alive" is a string that lingers, and the cost of a false
 * "dead" is a raw key on a card mid-game.
 */
export function keysMentionedIn(file) {
  // The raw source, not `stripNonCode`: that one blanks string literals, and
  // string literals are exactly what this is looking for. A key named in a
  // comment counts as alive, which is the generous side to err on.
  const code = readFileSync(file, 'utf8');
  const out = new Set();
  for (const [, key] of code.matchAll(/['"`]([a-z][\w]*(?:\.[\w]+)+)['"`]/g)) out.add(key);
  return out;
}

/** Every key mentioned anywhere in the project's own source. */
export function mentionedKeys(root) {
  const seen = new Set();
  for (const file of sourceFiles(root)) {
    if (file.endsWith('.test.js')) continue;
    if (file.includes('/i18n/strings/')) continue; // the tables are not a use
    for (const key of keysMentionedIn(file)) seen.add(key);
  }
  return seen;
}

/** `key_one` and `key_other` are the same key wearing a number. */
export const withoutPlural = (key) => key.replace(/_(one|other|zero|two|few|many)$/, '');

/**
 * Keys in a table that nothing in the project asks for.
 *
 * `live` is everything mentioned in the source plus everything the callers
 * build at runtime, which has to be enumerated from the data that builds it —
 * the roles registry, the scoring table, the changelog. See strings.test.js.
 */
export function deadKeys(table, live) {
  return Object.keys(table)
    .filter((key) => !live.has(withoutPlural(key)))
    .sort();
}

export { stripNonCode };
