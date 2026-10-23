/**
 * The linter, and proof that it bites.
 *
 * Run over the 3,000 shipped pairs it finds nothing, which is the right
 * answer and a worrying one: a check that passes on the day it is written is
 * indistinguishable from a check that does not work. So most of what follows
 * is deliberately bad packs, and the last test holds the real ones to zero.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import { lintPack, lintPacks, sameWordDifferentEnding } from './lint.js';
import { packsFor } from './index.js';
import { STRINGS } from '../../i18n/strings/index.js';

const pack = (pairs, extra = {}) => ({ id: 'test', lang: 'en', hint: 'Things', pairs, ...extra });
const whys = (findings) => findings.map((f) => f.why);

/* ------------------------------------------------------------------ *
 * The near miss that is the word
 * ------------------------------------------------------------------ */

test('a near miss that is the word, in any dress', () => {
  const found = lintPack(
    pack([
      { word: 'Pizza', decoy: 'pizza' },
      { word: 'Café', decoy: 'Cafe' },
      { word: 'Ice cream', decoy: 'ice-cream' },
    ]),
  );
  assert.deepEqual(whys(found), ['decoyIsTheWord', 'decoyIsTheWord', 'decoyIsTheWord']);
});

test('a near miss that is the same word with an ending on it', () => {
  const found = lintPack(
    pack([
      { word: 'Horse', decoy: 'Horses' },
      { word: 'Paint', decoy: 'Painting' },
    ]),
  );
  assert.deepEqual(whys(found), ['decoyIsTheSameWord', 'decoyIsTheSameWord']);
});

test('two different words that merely start alike are left alone', () => {
  // The whole value of a near miss is being close. Flagging these would make
  // the linter an argument rather than a help.
  const found = lintPack(
    pack([
      { word: 'Hotel', decoy: 'Hostel' },
      { word: 'Cocktail', decoy: 'Mocktail' },
      { word: 'Violin', decoy: 'Viola' },
      { word: 'Chiang Mai', decoy: 'Chiang Rai' },
    ]),
  );
  assert.deepEqual(found, [], 'these are good decoys, not faults');
});

test('a short stem is not enough to call two words the same', () => {
  // "Ant/Ants" is caught by nothing here on purpose: at three letters, the
  // rule would start catching unrelated words.
  assert.equal(sameWordDifferentEnding('Ant', 'Ants'), false);
  assert.equal(sameWordDifferentEnding('Horse', 'Horses'), true);
  assert.equal(sameWordDifferentEnding('Pizza', 'Pasta'), false);
  assert.equal(sameWordDifferentEnding('', 'Horses'), false);
});

test('an accent is not a different word, but a Thai vowel is', () => {
  // Both halves of this matter, and the second one was a bug: the first
  // version stripped every combining mark from everything, which is right
  // for é and wrong for Thai, where the vowels and tone marks ARE combining
  // marks. It turned ถังขยะ (a bin) and ถุงขยะ (a bin bag) into the same
  // string and called a good pair broken.
  assert.deepEqual(
    whys(lintPack(pack([{ word: 'Café', decoy: 'Cafe' }]))),
    ['decoyIsTheWord'],
    'é and e are one word',
  );
  assert.deepEqual(
    lintPack({ id: 't', lang: 'th', hint: 'ของใช้', pairs: [{ word: 'ถังขยะ', decoy: 'ถุงขยะ' }] }),
    [],
    'a bin and a bin bag are two words',
  );
  assert.deepEqual(
    lintPack({ id: 't', lang: 'th', hint: 'สัตว์', pairs: [{ word: 'งู', decoy: 'ปลาไหล' }] }),
    [],
    'and a snake is not given away by "animal"',
  );
});

test('German endings are judged by German rules', () => {
  assert.equal(sameWordDifferentEnding('Hund', 'Hunde', 'de'), true);
  assert.equal(sameWordDifferentEnding('Katze', 'Katzen', 'de'), true);
  assert.equal(sameWordDifferentEnding('Leopard', 'Gepard', 'de'), false);
});

/* ------------------------------------------------------------------ *
 * The other two
 * ------------------------------------------------------------------ */

test('a near miss that is somebody else’s answer in the same pack', () => {
  const found = lintPack(
    pack([
      { word: 'Sushi', decoy: 'Pizza' },
      { word: 'Pizza', decoy: 'Calzone' },
    ]),
  );
  assert.deepEqual(whys(found), ['decoyIsAnotherAnswer']);
  assert.equal(found[0].alsoAt, 2, 'and says which line it clashes with');
});

test('a pack name that gives a word away in hint mode', () => {
  const found = lintPack(
    pack([{ word: 'Coffee', decoy: 'Tea' }], { hint: 'Coffee and other drinks' }),
  );
  assert.deepEqual(whys(found), ['hintGivesItAway']);
});

test('an ordinary category gives nothing away', () => {
  const found = lintPack(pack([{ word: 'Coffee', decoy: 'Tea' }], { hint: 'Something you drink' }));
  assert.deepEqual(found, []);
});

test('no near miss at all is a choice, not a fault', () => {
  assert.deepEqual(lintPack(pack([{ word: 'Pizza', decoy: null }])), []);
});

test('an empty word is reported rather than ignored', () => {
  assert.deepEqual(whys(lintPack(pack([{ word: '', decoy: 'x' }]))), ['emptyWord']);
});

test('nonsense in, nothing out', () => {
  for (const junk of [null, undefined, {}, { pairs: null }, 42]) {
    assert.deepEqual(lintPack(junk), []);
  }
});

test('every finding carries the line it came from', () => {
  const found = lintPack(
    pack([
      { word: 'Fine', decoy: null },
      { word: 'Horse', decoy: 'Horses' },
    ]),
  );
  assert.equal(found[0].at, 2, 'the second line, not the first');
  assert.equal(found[0].word, 'Horse');
});

/* ------------------------------------------------------------------ *
 * Saying it out loud
 * ------------------------------------------------------------------ */

test('every complaint has a sentence in every language', () => {
  // A warning the editor cannot render is a warning nobody reads.
  const codes = [
    'decoyIsTheWord',
    'decoyIsTheSameWord',
    'decoyIsAnotherAnswer',
    'hintGivesItAway',
    'emptyWord',
  ];
  for (const code of codes) {
    for (const lang of Object.keys(STRINGS)) {
      assert.ok(STRINGS[lang][`packs.warn.${code}`], `${lang} says nothing about ${code}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * And the packs that actually ship
 * ------------------------------------------------------------------ */

test('every pack the game ships is clean', () => {
  for (const lang of ['en', 'th', 'de']) {
    const found = lintPacks(packsFor(lang));
    assert.deepEqual(
      found,
      [],
      `${lang}: ${found.map((f) => `${f.pack} #${f.at} ${f.word} (${f.why})`).join(', ')}`,
    );
  }
});
