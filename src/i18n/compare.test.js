/**
 * Comparing one language with another.
 *
 * This is what the translator's board at `#strings` shows and what the suite
 * checks, so it has to be right about four different things — and, more
 * importantly, has to not cry wolf. A board that flags 455 keys is a board
 * nobody opens twice.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../testing/ready.js';

import { compareAll, compareKey, hasTrouble, readsAsUntranslated } from './compare.js';
import { STRINGS } from './strings/index.js';

const tables = (overrides = {}) => ({
  en: { greeting: 'Good evening, everyone', oneWord: 'System', count_one: '{count} card', count_other: '{count} cards', ...overrides.en },
  th: { greeting: 'สวัสดีตอนเย็นทุกคน', oneWord: 'System', count_other: '{count} ใบ', ...overrides.th },
  de: { greeting: 'Guten Abend zusammen', oneWord: 'System', count_one: 'Eine Karte', count_other: '{count} Karten', ...overrides.de },
});

test('a language missing a sentence is missing it', () => {
  const t = tables();
  delete t.de.greeting;
  const row = compareKey('greeting', t);
  assert.deepEqual(row.missing, ['de']);
  assert.ok(hasTrouble(row));
});

test('a language that does not count its nouns is not missing anything', () => {
  // Thai has no singular, and `resolveKey` falls back to that language's own
  // `_other` long before it reaches English. Reporting this as missing sends
  // a translator looking for something there is no way to write.
  const row = compareKey('count_one', tables());
  assert.deepEqual(row.missing, [], 'nothing is missing');
  assert.deepEqual(row.noPlural, ['th'], 'it simply has no singular');
  assert.equal(hasTrouble(row), false, 'and it is not worth anybody looking at');
});

test('but a language that has neither form really is missing it', () => {
  const t = tables();
  delete t.th.count_other;
  const row = compareKey('count_one', t);
  assert.deepEqual(row.missing, ['th']);
});

test('a sentence copied from English word for word is flagged', () => {
  const t = tables({ de: { greeting: 'Good evening, everyone' } });
  const row = compareKey('greeting', t);
  assert.deepEqual(row.copied, ['de']);
});

test('a single word that is the same in two languages is not', () => {
  // German says System, Auto, Blind, Crew, Pause. Flagging those teaches
  // people to ignore the board.
  assert.deepEqual(compareKey('oneWord', tables()).copied, [], 'System is System');
  assert.equal(readsAsUntranslated('System'), false);
  assert.equal(readsAsUntranslated('{count}'), false);
  assert.equal(readsAsUntranslated('2026-10-19'), false);
  assert.equal(readsAsUntranslated('Good evening, everyone'), true);
});

test('a translation that invents a placeholder is flagged, because a player sees it', () => {
  const t = tables({ de: { greeting: 'Guten Abend {name}' } });
  const row = compareKey('greeting', t);
  assert.equal(row.placeholders[0].lang, 'de');
  assert.match(row.placeholders[0].trouble, /invents \{name\}/);
});

test('a singular that drops the numeral is allowed, anywhere else is not', () => {
  // "Es fehlt noch einer." is German written properly, not a string written
  // carelessly.
  assert.deepEqual(compareKey('count_one', tables()).placeholders, []);
  const t = tables({ de: { count_other: 'Mehrere Karten' } });
  assert.match(compareKey('count_other', t).placeholders[0].trouble, /drops \{count\}/);
});

test('every key in any table gets a row, sorted', () => {
  const rows = compareAll(tables({ de: { onlyGerman: 'nur hier' } }));
  const keys = rows.map((r) => r.key);
  assert.deepEqual(keys, [...keys].sort(), 'sorted, so two runs read the same');
  assert.ok(keys.includes('onlyGerman'), 'including one only a translation has');
});

test('the real tables have nothing on them worth a look', () => {
  // The same answer the board gives, so the board cannot quietly disagree
  // with the suite.
  const trouble = compareAll(STRINGS).filter(hasTrouble);
  assert.deepEqual(
    trouble.map((r) => r.key),
    [],
    `${trouble.length} keys would be flagged on the board`,
  );
});
