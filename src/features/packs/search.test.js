/**
 * Searching the shelf.
 *
 * The real packs are the fixture here rather than made-up ones: a search that
 * works on ["Apple", "Banana"] and not on three thousand real words in three
 * scripts has not been tested.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { filterPack, shelfFor, matchAt } from './search.js';
import { packsFor } from '../../content/words/index.js';
import { buildPack } from '../../content/words/custom.js';
import '../../testing/ready.js';

const en = packsFor('en');
const th = packsFor('th');
const food = en.find((p) => p.id === 'food');

const mine = buildPack({
  name: 'Our flat',
  lang: 'en',
  text: 'Sofa, Armchair\nKettle\nBalcony\nThe loud fridge\nBroken blind',
}).pack;

test('a word is found by part of itself', () => {
  const hits = filterPack(food, 'fried');
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((p) => /fried/i.test(`${p.word} ${p.decoy ?? ''}`)));
});

test('a near miss is findable too, because it is a real word in the pack', () => {
  const hits = filterPack(food, 'sashimi');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].word, 'Sushi', 'found by what the imposter would be holding');
});

test('case does not matter', () => {
  assert.deepEqual(filterPack(food, 'pizza'), filterPack(food, 'PIZZA'));
});

test('Thai is searched by its own marks, not stripped of them', () => {
  const thFood = th.find((p) => p.id === 'food');
  const withMarks = filterPack(thFood, 'ข้าว');
  assert.ok(withMarks.length > 0, 'nothing found for a common Thai word');
  // ขาว (white) is not ข้าว (rice): stripping the mark would conflate them.
  const stripped = filterPack(thFood, 'ขาว');
  assert.notDeepEqual(withMarks, stripped);
});

test('nothing typed means the whole pack', () => {
  assert.equal(filterPack(food, '').length, food.pairs.length);
});

test('a search nobody can satisfy comes back empty rather than full', () => {
  assert.deepEqual(filterPack(food, 'qzx'), []);
});

test('the shelf puts the table’s own packs first', () => {
  const shelf = shelfFor([...en, mine], '');
  assert.equal(shelf[0].pack.id, mine.id);
  assert.equal(shelf.length, en.length + 1, 'and keeps every pack when nothing is typed');
});

test('a search hides the packs with nothing in them', () => {
  const shelf = shelfFor(en, 'sashimi');
  assert.equal(shelf.length, 1);
  assert.equal(shelf[0].pack.id, 'food');
});

test('the counts a search reports add up to what it shows', () => {
  const shelf = shelfFor(en, 'a');
  const shown = shelf.reduce((n, { pairs }) => n + pairs.length, 0);
  const counted = shelf.flatMap(({ pairs }) => pairs).length;
  assert.equal(shown, counted);
  assert.ok(shown < 1000, 'a search that returns everything is not a search');
  assert.ok(shown > 0);
});

test('searching does not disturb the packs it searched', () => {
  const before = JSON.stringify(en);
  shelfFor(en, 'rice');
  assert.equal(JSON.stringify(en), before, 'the shelf was sorted in place');
});

test('a match is marked where it actually is', () => {
  assert.equal(matchAt('Fried rice', 'rice'), 6);
  assert.equal(matchAt('Fried rice', 'RICE'.toLowerCase()), 6);
  assert.equal(matchAt('Fried rice', ''), -1, 'nothing typed marks nothing');
  assert.equal(matchAt('Fried rice', 'sushi'), -1);
});

test('every built-in pack can be copied out as a list the editor takes', () => {
  // The library offers "copy as list" so ours can be a starting point for
  // yours; a line that would not parse back is a broken promise.
  for (const pack of [...en, ...th]) {
    for (const pair of pack.pairs) {
      assert.ok(!/[,;|\t]/.test(pair.word), `${pack.id}: "${pair.word}" has a separator in it`);
      if (pair.decoy) {
        assert.ok(!/[,;|\t]/.test(pair.decoy), `${pack.id}: "${pair.decoy}" has a separator in it`);
      }
    }
  }
});
