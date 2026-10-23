/**
 * The pack format: what a paste turns into, and what survives a code.
 *
 * This is the one part of the game a player can hand arbitrary text to, and
 * the one part that accepts data from a stranger's phone, so most of these
 * are about what happens when the input is not what anybody hoped for.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import {
  parsePairs,
  buildPack,
  validatePack,
  encodePack,
  decodePack,
  toText,
  isCustomPackId,
  PACK_LIMITS,
} from './custom.js';

const listOf = (n, prefix = 'Word') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join('\n');

test('a pasted list becomes pairs', () => {
  const { pairs } = parsePairs('Sushi, Sashimi\nKhao soi\nPad thai | Pad see ew');
  assert.deepEqual(pairs, [
    { word: 'Sushi', decoy: 'Sashimi' },
    { word: 'Khao soi', decoy: null },
    { word: 'Pad thai', decoy: 'Pad see ew' },
  ]);
});

test('every separator people actually paste is understood', () => {
  const { pairs } = parsePairs(
    ['A, one', 'B; two', 'C | three', 'D\tfour', 'E – five', 'F — six'].join('\n'),
  );
  assert.deepEqual(
    pairs.map((p) => p.decoy),
    ['one', 'two', 'three', 'four', 'five', 'six'],
  );
});

test('blank lines, notes and stray spacing are ignored', () => {
  const { pairs } = parsePairs('# our flat\n\n  Sofa ,  Armchair  \n\n   \nLamp # the tall one\n');
  assert.deepEqual(pairs, [
    { word: 'Sofa', decoy: 'Armchair' },
    { word: 'Lamp', decoy: null },
  ]);
});

test('a near miss that is the word is not a near miss', () => {
  const { pairs } = parsePairs('Sushi, sushi');
  assert.deepEqual(pairs, [{ word: 'Sushi', decoy: null }]);
});

test('the same word twice is reported rather than dealt twice', () => {
  const { pairs, skipped } = parsePairs('Sushi\nRamen\nsushi, Sashimi');
  assert.equal(pairs.length, 2);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].why, 'duplicate');
  assert.equal(skipped[0].at, 3, 'and it says which line');
});

test('a line nobody could fit on a card is skipped, and said so', () => {
  const { pairs, skipped } = parsePairs(`${'x'.repeat(PACK_LIMITS.word + 1)}\nFine`);
  assert.deepEqual(
    pairs.map((p) => p.word),
    ['Fine'],
  );
  assert.equal(skipped[0].why, 'tooLong');
});

test('a pasted novel stops at the limit instead of taking the phone with it', () => {
  const { pairs, skipped } = parsePairs(listOf(PACK_LIMITS.pairs + 25));
  assert.equal(pairs.length, PACK_LIMITS.pairs);
  assert.equal(skipped.length, 25);
  assert.ok(skipped.every((s) => s.why === 'tooMany'));
});

test('a pack needs a name and enough in it', () => {
  assert.equal(buildPack({ name: '', lang: 'en', text: listOf(10) }).error, 'packNeedsName');
  const small = buildPack({ name: 'Ours', lang: 'en', text: listOf(2) });
  assert.equal(small.error, 'packTooSmall');
  assert.equal(small.params.min, PACK_LIMITS.minPairs);
  assert.equal(small.params.count, 2, 'and says how many it found');
});

test('a built pack is ready to be dealt from', () => {
  const { pack } = buildPack({ name: '  Our flat  ', emoji: '🏠', lang: 'th', text: listOf(8) });
  assert.ok(isCustomPackId(pack.id));
  assert.equal(pack.name, 'Our flat');
  assert.equal(pack.lang, 'th');
  assert.equal(pack.custom, true);
  assert.equal(pack.pairs.length, 8);
  // Hint mode describes a word by its category; for a pack somebody wrote,
  // the name is the only category there is.
  assert.equal(pack.hint, 'Our flat');
});

test('a pack with no emoji still has one', () => {
  const { pack } = buildPack({ name: 'Ours', lang: 'en', text: listOf(6) });
  assert.ok(pack.emoji.length > 0);
});

test('a code survives the round trip, in any language', () => {
  for (const [lang, text] of [
    ['en', 'Sushi, Sashimi\nRamen\nGyoza\nUdon\nMiso'],
    ['th', 'ผัดไทย, ผัดซีอิ๊ว\nข้าวมันไก่\nส้มตำ\nต้มยำ\nลาบ'],
    ['de', 'Brezel, Laugenstange\nSpätzle\nKnödel\nWurst\nSenf'],
  ]) {
    const { pack } = buildPack({ name: 'Food', emoji: '🍜', lang, text });
    const back = decodePack(encodePack(pack));
    assert.ok(back, `${lang}: nothing came back`);
    assert.equal(back.name, pack.name);
    assert.equal(back.emoji, pack.emoji);
    assert.equal(back.lang, pack.lang);
    assert.deepEqual(back.pairs, pack.pairs, `${lang}: the words changed on the way`);
  }
});

test('a code pasted out of a chat app, line breaks and all, still loads', () => {
  const { pack } = buildPack({ name: 'Food', lang: 'en', text: listOf(9) });
  const code = encodePack(pack);
  const mangled = `${code.slice(0, 20)}\n   ${code.slice(20, 60)}\n${code.slice(60)}  `;
  assert.deepEqual(decodePack(mangled).pairs, pack.pairs);
});

test('nonsense is refused rather than half-loaded', () => {
  for (const bad of ['', 'hello', 'IMP1.', 'IMP1.%%%%', 'IMP1.' + 'A'.repeat(40), null, undefined]) {
    assert.equal(decodePack(bad), null, `${bad} should not decode`);
  }
});

test('a pack from somewhere else is cleaned before it is believed', () => {
  const messy = {
    id: 'not-a-custom-id',
    name: '  A very long name that goes on and on and on and on  ',
    emoji: '🎈🎈🎈🎈🎈🎈',
    pairs: [
      { word: 'Keep', decoy: 'This' },
      { word: '', decoy: 'nothing' },
      { word: 'Keep', decoy: 'duplicate' },
      { word: 'Self', decoy: 'self' },
      { word: 'X'.repeat(200), decoy: 'Y'.repeat(200) },
      'not an object',
      null,
      { word: 'Fine' },
      { word: 'Also fine', decoy: 'Nearly' },
      { word: '  Padded  ', decoy: '  Spaced  ' },
    ],
  };
  const pack = validatePack(messy, 'en');
  assert.ok(pack);
  assert.ok(isCustomPackId(pack.id), 'a made-up id is replaced');
  assert.ok(pack.name.length <= PACK_LIMITS.name);
  assert.ok(pack.emoji.length <= 4);
  assert.deepEqual(pack.pairs, [
    { word: 'Keep', decoy: 'This' },
    { word: 'Self', decoy: null },
    { word: 'X'.repeat(PACK_LIMITS.word), decoy: 'Y'.repeat(PACK_LIMITS.word) },
    { word: 'Fine', decoy: null },
    { word: 'Also fine', decoy: 'Nearly' },
    { word: 'Padded', decoy: 'Spaced' },
  ]);
});

test('what is not a pack comes back as nothing at all', () => {
  for (const bad of [null, undefined, 42, 'pack', {}, { name: 'x' }, { name: 'x', pairs: [] }]) {
    assert.equal(validatePack(bad, 'en'), null);
  }
});

test('a pack can be edited: text out, text in, same pack', () => {
  const text = 'Sushi, Sashimi\nRamen\nGyoza\nUdon\nMiso';
  const { pack } = buildPack({ name: 'Food', lang: 'en', text });
  assert.equal(toText(pack.pairs), text);
  const again = buildPack({ id: pack.id, name: pack.name, lang: 'en', text: toText(pack.pairs) });
  assert.equal(again.pack.id, pack.id, 'editing keeps the pack it was');
  assert.deepEqual(again.pack.pairs, pack.pairs);
});

test('a word with no letters or digits in it is not a word', () => {
  // `normalise` keeps only letters, digits and marks, so these all reduce to
  // the empty string. Dealt as the secret, such a word cannot be guessed by
  // typing it — and before `sameWord`, it was "matched" by typing nothing.
  const letterless = {
    name: 'Degenerate',
    pairs: [{ word: '???' }, { word: '!!!' }, { word: '...' }, { word: ',,,' }, { word: ';;;' }],
  };
  assert.equal(validatePack(letterless, 'en'), null, 'a pack of non-words is not a pack');

  const mixed = {
    name: 'Mixed',
    pairs: [
      { word: 'alpha', decoy: '???' },
      { word: '???' },
      { word: 'beta' },
      { word: 'gamma' },
      { word: 'delta' },
      { word: 'epsilon' },
    ],
  };
  const pack = validatePack(mixed, 'en');
  assert.ok(pack, 'the real words still make a pack');
  assert.deepEqual(
    pack.pairs.map((p) => p.word),
    ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
  );
  assert.equal(pack.pairs[0].decoy, null, 'a letterless decoy is no decoy');
});

test('emoji and scripts without Latin letters are still words', () => {
  // The rule is "has a letter or a digit anywhere", not "is Latin": Thai has
  // no spaces and no Latin letters, and a table playing in Thai writes packs.
  const thai = {
    name: 'ไทย',
    pairs: [
      { word: 'ข้าวกล้อง' },
      { word: 'กล่องข้าว' },
      { word: 'โรงเรียน' },
      { word: 'ตลาดนัด' },
      { word: 'รถไฟฟ้า' },
    ],
  };
  const pack = validatePack(thai, 'th');
  assert.ok(pack, 'a Thai pack is a pack');
  assert.equal(pack.pairs.length, 5);

  // A digit counts too — "7" is a thing you can say a clue about.
  const digits = {
    name: 'Numbers',
    pairs: [{ word: '7' }, { word: '42' }, { word: '100' }, { word: '2024' }, { word: '13' }],
  };
  assert.equal(validatePack(digits, 'en')?.pairs.length, 5);
});
