/**
 * The interface strings, and how one gets chosen.
 *
 * Three languages drift apart quietly: a key gets added to English and
 * forgotten in the other two, a translation loses its {name}, a plural form
 * resolves to the wrong language and nobody notices until somebody plays in
 * that language and sees English.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { STRINGS, LANGUAGES, FALLBACK_LANG } from './strings/index.js';
import { translate } from './translate.js';
import '../testing/ready.js';

const LANGS = LANGUAGES.map((l) => l.id);
const EN = STRINGS[FALLBACK_LANG];

/** The {placeholders} a template expects, as a comparable string. */
const slots = (text) =>
  [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

/** Plural keys are declared per language, so compare the base names. */
const baseKeys = (table) =>
  new Set(Object.keys(table).map((k) => k.replace(/_(one|other)$/, '')));

test('every language declares every string', () => {
  for (const lang of LANGS) {
    const missing = [...baseKeys(EN)].filter((k) => !baseKeys(STRINGS[lang]).has(k));
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  }
});

test('no language invents a string the others do not have', () => {
  for (const lang of LANGS) {
    const extra = [...baseKeys(STRINGS[lang])].filter((k) => !baseKeys(EN).has(k));
    assert.deepEqual(extra, [], `${lang} has stray keys: ${extra.join(', ')}`);
  }
});

test('a translation never drops a placeholder it is given', () => {
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(STRINGS[lang])) {
      if (!(key in EN)) continue;
      // A _one form may legitimately spell the number out ("one more player"),
      // so it is allowed to use fewer slots — never a different one.
      const theirs = slots(text).split(',').filter(Boolean);
      const ours = slots(EN[key]).split(',').filter(Boolean);
      for (const slot of theirs) {
        assert.ok(ours.includes(slot), `${lang}/${key} uses {${slot}}, which English does not`);
      }
      if (!/_one$/.test(key)) {
        assert.equal(
          slots(text),
          slots(EN[key]),
          `${lang}/${key} should take the same placeholders as English`,
        );
      }
    }
  }
});

test('nothing is blank', () => {
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(STRINGS[lang])) {
      assert.equal(typeof text, 'string', `${lang}/${key} is not a string`);
      assert.ok(text.trim().length > 0, `${lang}/${key} is empty`);
    }
  }
});

test('a count of one is answered in the reader’s own language', () => {
  // Thai declares no _one form at all. Asking for one of something used to
  // resolve to `_one`, find nothing in Thai, and hand back the English
  // sentence — so a Thai player read English every time a count landed on 1.
  for (const key of ['vote.count', 'vote.left', 'lobby.needMore', 'reveal.cardsLeft', 'reveal.waiting']) {
    for (const count of [0, 1, 2, 7]) {
      for (const lang of LANGS) {
        const text = translate(lang, key, { count });
        assert.ok(text && text !== key, `${lang}/${key} (${count}) resolved to nothing`);
        if (lang === FALLBACK_LANG) continue;
        const english = translate(FALLBACK_LANG, key, { count });
        assert.notEqual(
          text,
          english,
          `${lang}/${key} fell back to English on a count of ${count}`,
        );
      }
    }
  }
});

test('the count itself is interpolated', () => {
  assert.match(translate('en', 'vote.count', { count: 3 }), /3/);
  assert.match(translate('th', 'vote.count', { count: 3 }), /3/);
  assert.match(translate('de', 'vote.count', { count: 3 }), /3/);
});

test('an unknown language reads English rather than key names', () => {
  assert.equal(translate('xx', 'common.gotIt'), EN['common.gotIt']);
});

test('an unknown key comes back as itself, not as undefined', () => {
  assert.equal(translate('en', 'nothing.here'), 'nothing.here');
});

test('a placeholder with no value is left alone rather than printed as undefined', () => {
  const text = translate('en', 'errors.duplicateName', {});
  assert.ok(!/undefined/.test(text), text);
});

test('a big number is written the way the language writes it', () => {
  // A screen that can say three thousand of something has to say it properly:
  // English groups with a comma, German with a stop.
  assert.match(translate('en', 'settings.packsAll', { count: 3000 }), /3,000/);
  assert.match(translate('de', 'settings.packsAll', { count: 3000 }), /3\.000/);
  assert.match(translate('th', 'settings.packsAll', { count: 3000 }), /3,000/);
});

test('small numbers are left alone, and a version is not a number at all', () => {
  assert.match(translate('en', 'packs.count', { count: 8 }), /\b8\b/);
  assert.equal(translate('en', 'home.whatsNew', { version: '1.19.0' }), 'What changed in 1.19.0?');
  assert.equal(
    translate('de', 'home.whatsNew', { version: '1.19.0' }),
    'Was ist neu in 1.19.0?',
    'a version string must not be grouped into 1.19,0',
  );
});
