/**
 * Fetching a language's words, and the trap that came with it.
 *
 * Deliberately does NOT import ../../testing/ready.js: every other test file
 * starts with all three languages in memory, which is the one state in which
 * none of this can go wrong. This file starts from nothing, like a phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_WORD_LANG,
  loadWords,
  loadAllWords,
  packsFor,
  pairCount,
  poolFor,
  wordsReady,
  _forgetWords,
} from './index.js';
import { createGame, reduce, GameError, PHASE } from '../../core/engine.js';
import { validatePack } from './custom.js';

test.beforeEach(() => _forgetWords());
test.after(() => _forgetWords());

test('nothing is here until it is asked for', () => {
  assert.equal(wordsReady('en'), false);
  assert.deepEqual(packsFor('en'), []);
});

test('a language arrives when it is fetched', async () => {
  await loadWords('en');
  assert.equal(wordsReady('en'), true);
  assert.equal(packsFor('en').length, 10);
  assert.equal(wordsReady('th'), false, 'and brings nobody else with it');
});

test('asking twice is one fetch, not two', async () => {
  const [a, b] = await Promise.all([loadWords('de'), loadWords('de')]);
  assert.equal(a, b, 'the same packs object both times');
});

test('a language we have never heard of is empty rather than an exception', async () => {
  assert.deepEqual(await loadWords('xx'), []);
  assert.deepEqual(packsFor('xx'), [], 'and falls back to English only for display');
});

test('a language we ship but have not fetched does NOT become English', async () => {
  // This is the one that would be invisible: a Thai table dealt English words
  // because the fallback fired while Thai was still in the air. Nobody would
  // see anything wrong until they read their card.
  await loadWords('en');
  assert.equal(wordsReady('th'), false);
  assert.deepEqual(packsFor('th'), [], 'empty, not English');
  assert.deepEqual(poolFor('th', [], []), []);
});

test('a pool asked for too early does not poison the one asked for later', async () => {
  // The actual bug, found by the browser sweep. The settings screen asks for
  // a word count on every render, including the renders that happen while a
  // language is still downloading. That first call cached an EMPTY pool under
  // the key the deal would later use — so the words arrived, the button went
  // green, and the deal failed with "no packs".
  assert.equal(pairCount('en', [], []), 0, 'nothing is here yet');
  assert.deepEqual(poolFor('en', [], []), [], 'and the pool is empty');

  await loadWords('en');

  assert.ok(pairCount('en', [], []) > 900, 'the count is real now');
  assert.ok(poolFor('en', [], []).length > 900, 'and so is the pool');
});

test('a game dealt after the words arrive is a real game', async () => {
  await loadWords(DEFAULT_WORD_LANG);
  let state = createGame({ wordLang: DEFAULT_WORD_LANG });
  for (const name of ['Ann', 'Ben', 'Cal', 'Dee']) {
    state = reduce(state, { type: 'ADD_PLAYER', name });
  }
  state = reduce(state, { type: 'START_GAME', seed: 4 });
  assert.equal(state.phase, PHASE.REVEAL);
  assert.ok(state.secretWord, 'with a word in it');
});

test('a game dealt before they arrive is refused, loudly', async () => {
  // The failure mode has to be a refusal somebody can read, not a round with
  // no word in it.
  let state = createGame({ wordLang: 'th' });
  for (const name of ['Ann', 'Ben', 'Cal', 'Dee']) {
    state = reduce(state, { type: 'ADD_PLAYER', name });
  }
  assert.throws(
    () => reduce(state, { type: 'START_GAME', seed: 4 }),
    (err) => err instanceof GameError && err.code === 'noPacks',
  );
});

test('loading everything loads everything', async () => {
  await loadAllWords();
  for (const lang of ['en', 'th', 'de']) {
    assert.equal(wordsReady(lang), true, lang);
    assert.equal(packsFor(lang).length, 10, lang);
  }
});

test('editing a pack without changing its size still changes what is dealt', () => {
  // The cache key was `id:pairs.length`. The editor keeps a pack's id, and
  // rewriting its words keeps the count, so the two agreed and the pool was
  // served from cache: a table that replaced all five of their words went on
  // being dealt the five they had deleted, and the new ones could never come
  // up at all until the page was reloaded. Adding or removing one entry
  // masked it, which is why it survived every casual try.
  const build = (words) =>
    validatePack(
      {
        id: 'custom:cachetest',
        name: 'Our street',
        lang: 'en',
        pairs: words.map((word) => ({ word, decoy: null })),
      },
      'en',
    );

  const before = build(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
  const first = poolFor('en', [before.id], [before]).map((p) => p.word);
  assert.deepEqual(first, ['alpha', 'beta', 'gamma', 'delta', 'epsilon']);

  const after = build(['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE']);
  assert.equal(after.id, before.id, 'the editor keeps the id');
  assert.equal(after.pairs.length, before.pairs.length, 'and the same number of words');

  const second = poolFor('en', [after.id], [after]).map((p) => p.word);
  assert.deepEqual(second, ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE']);
  for (const gone of first) {
    assert.ok(!second.includes(gone), `${gone} was deleted and is still in the pool`);
  }

  // Changing only a decoy counts too — it is what the imposter is handed.
  const decoyed = validatePack(
    {
      id: 'custom:cachetest',
      name: 'Our street',
      lang: 'en',
      pairs: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].map((word) => ({ word, decoy: `${word}-ish` })),
    },
    'en',
  );
  const third = poolFor('en', [decoyed.id], [decoyed]);
  assert.equal(third[0].decoy, 'ONE-ish');
});
