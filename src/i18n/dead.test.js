/**
 * Keys nothing asks for.
 *
 * The suite has always checked the other direction — a screen asking for a
 * key nobody wrote — because that one shows a raw key to a player. This is
 * the quieter failure: a string that stays in all three tables after the
 * screen that used it was rewritten. Nothing breaks, the tables just grow,
 * and a translator looking at the job sees more of it than there is.
 *
 * The hard part is that plenty of keys are never written down anywhere: they
 * are built at runtime from a role id, an error code, a release number. Those
 * are enumerated below from the data that builds them, which has the useful
 * side effect of failing when a family grows a member nobody wrote a string
 * for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../testing/ready.js';

import { deadKeys, mentionedKeys } from '../testing/checks/strings.js';
import { sourceFiles } from '../testing/checks/names.js';
import { STRINGS, LANGUAGES } from './strings/index.js';
import { ROLES, WIN_REASONS } from '../core/engine.js';
import { RELEASES } from '../content/history/changelog.js';
import { MODES, THEMES } from '../ui/theme/themes.js';
import { PACK_LIMITS } from '../content/words/custom.js';
import { PRESETS } from '../features/lobby/presets.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Keys that are built rather than written, enumerated from what builds them.
 *
 * Each line here is a promise that the family is complete. If somebody adds
 * a role, a way to win or a release, the enumeration grows with it and the
 * missing-string check next door starts asking for the new key.
 */
function builtAtRuntime() {
  const keys = new Set();

  for (const role of ROLES) {
    keys.add(`role.${role.id}`);
    keys.add(`role.${role.id}Tip`);
    keys.add(`role.${role.id}Card`);
  }
  for (const reason of Object.keys(WIN_REASONS)) {
    keys.add(`over.reason.${reason}`);
    keys.add(`score.worth.${reason}`);
  }
  for (const release of RELEASES) {
    for (const note of release.notes) keys.add(`log.${release.v}.${note}`);
  }
  for (const n of [1, 2, 3, 4]) {
    keys.add(`rules.${n}.title`);
    keys.add(`rules.${n}.body`);
  }
  for (const mode of MODES) keys.add(`display.mode.${mode}`);
  for (const theme of THEMES) keys.add(`theme.${theme.id}`);
  // The stepper announces one of two things, not one per phase.
  keys.add('step.clues');
  keys.add('step.result');
  // Why a pasted line was skipped, and why a pair would not play.
  for (const why of ['duplicate', 'tooLong', 'tooMany']) keys.add(`packs.skipped.${why}`);
  for (const why of [
    'decoyIsTheWord',
    'decoyIsTheSameWord',
    'decoyIsAnotherAnswer',
    'hintGivesItAway',
    'emptyWord',
  ]) {
    keys.add(`packs.warn.${why}`);
  }
  // A rule violation, by code. These are thrown from the engine, the server
  // and the room client, so they are read out of the source rather than
  // listed by hand — a list by hand is a list that goes stale.
  for (const code of errorCodesInSource()) keys.add(`errors.${code}`);
  // The two faces a revealed card can wear.
  for (const face of ['crew', 'imposter']) keys.add(`reveal.${face}`);
  // Each way a table can choose to play, and the line under it.
  for (const preset of PRESETS) {
    keys.add(`settings.preset.${preset.id}`);
    keys.add(`settings.preset.${preset.id}Hint`);
  }
  keys.add('settings.preset.custom');
  keys.add('settings.preset.customHint');
  return keys;
}

/** Every code the project can refuse with. */
function errorCodesInSource() {
  const codes = new Set();
  for (const file of sourceFiles(root)) {
    // Not the tests: they invent codes to stand in for a server's reply, and
    // an invented code is not something the app can ever refuse with.
    if (file.endsWith('.test.js')) continue;
    const code = readFileSync(file, 'utf8');
    for (const [, c] of code.matchAll(/\bfail\(\s*'(\w+)'/g)) codes.add(c);
    for (const [, c] of code.matchAll(/\bGameError\(\s*'(\w+)'/g)) codes.add(c);
    for (const [, c] of code.matchAll(/\bApiError\(\s*'(\w+)'/g)) codes.add(c);
    for (const [, c] of code.matchAll(/\berror:\s*'(\w+)'/g)) codes.add(c);
    for (const [, c] of code.matchAll(/setError\(\s*\{\s*code:\s*'(\w+)'/g)) codes.add(c);
  }
  return codes;
}

test('nothing in the tables is there for no reason', () => {
  const live = new Set([...mentionedKeys(root), ...builtAtRuntime()]);
  const dead = deadKeys(STRINGS.en, live);
  assert.deepEqual(
    dead,
    [],
    `these keys are written and never asked for:\n  ${dead
      .map((k) => `${k} = ${JSON.stringify(STRINGS.en[k])}`)
      .join('\n  ')}`,
  );
});

test('and the other two tables hold nothing English does not', () => {
  // A key removed from English but left in a translation is the same waste,
  // and harder to see because nothing reads it.
  for (const { id } of LANGUAGES) {
    if (id === 'en') continue;
    const extra = Object.keys(STRINGS[id]).filter((key) => !(key in STRINGS.en));
    assert.deepEqual(extra, [], `${id} has keys English does not: ${extra.join(', ')}`);
  }
});

test('every key built at runtime is a key somebody wrote', () => {
  // The enumeration above is the list of what the app can ask for. If a role
  // or a way to win is added without a string, this is where it is noticed.
  const missing = [...builtAtRuntime()].filter((key) => !STRINGS.en[key]).sort();
  assert.deepEqual(missing, [], `built at runtime but never written: ${missing.join(', ')}`);
});
