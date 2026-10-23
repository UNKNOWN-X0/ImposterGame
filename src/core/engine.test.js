/**
 * Rules engine tests. Run with: npm test
 * No dependencies — this uses Node's built-in test runner.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { poolFor, packsFor, pairCount } from '../content/words/index.js';
import { mulberry32 } from './rng.js';
import { pickWord, pickImposters } from './deal.js';
import '../testing/ready.js';
import {
  PHASE,
  GameError,
  normalise,
  DEFAULT_CONFIG,
  DECOY,
  IMPOSTERS_AUTO,
  ROLE,
  SPECIAL_ROLES,
  WIN_POINTS,
  MAX_WIN_POINTS,
  isImposter,
  isAlive,
  PLAIN_CREW_FLOOR,
  roleOf,
  isImposterSide,
  playerById,
  IMPOSTERS_RANDOM,
  ROUNDS_UNLIMITED,
  SAFETY_ROUNDS,
  EMPTY_HISTORY,
  autoImposterCount,
  resolveImposterCount,
  canCall,
  createGame,
  reduce,
  applyAll,
  currentTurn,
  speakingOrder,
  pendingVoters,
  viewFor,
  publicState,
  sameWord,
  maxImpostersFor,
  alivePlayers,
} from './engine.js';

/* helpers ---------------------------------------------------------- */

const withPlayers = (names, config = {}) =>
  applyAll(
    createGame(config),
    names.map((name, i) => ({ type: 'ADD_PLAYER', name, id: `p${i + 1}` })),
  );

const started = (names, config = {}, seed = 42) =>
  reduce(withPlayers(names, config), { type: 'START_GAME', seed });

const revealAll = (s) =>
  applyAll(s, s.players.map((p) => ({ type: 'MARK_REVEALED', playerId: p.id })));

/** Everyone still in gives a clue, in turn order. Clues must all differ. */
let clueSeq = 0;
const clueRound = (s) => {
  let state = s;
  while (state.phase === PHASE.CLUES) {
    const turn = currentTurn(state);
    state = reduce(state, { type: 'SUBMIT_CLUE', playerId: turn, text: `clue${clueSeq++}` });
  }
  return state;
};

/** Everyone alive votes for `targetId` (the target votes for someone else). */
const voteOut = (s, targetId) => {
  let state = s;
  for (const p of alivePlayers(state)) {
    if (!(p.id in state.votes)) {
      const target =
        p.id === targetId ? alivePlayers(state).find((q) => q.id !== targetId).id : targetId;
      state = reduce(state, { type: 'CAST_VOTE', voterId: p.id, targetId: target });
    }
  }
  return state;
};

const FIVE = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli'];

/* lobby ------------------------------------------------------------ */

test('players can be added and removed in the lobby', () => {
  let s = withPlayers(['Ann', 'Ben']);
  assert.equal(s.players.length, 2);
  s = reduce(s, { type: 'REMOVE_PLAYER', playerId: 'p1' });
  assert.deepEqual(s.players.map((p) => p.name), ['Ben']);
});

test('somebody who leaves the lobby takes everything of theirs with them', () => {
  // Found by the fuzzer: their points stayed behind. Ids are minted per
  // player, so adding the same person back gives them a new one and the old
  // entry can never be reached again — it just sits in the state, goes out
  // to every phone in the room, and is carried around all evening.
  let s = withPlayers(['Ann', 'Ben']);
  s = {
    ...s,
    scores: { p1: 4, p2: 2 },
    lastWinners: ['p1', 'p2'],
    history: { ...s.history, lastImposters: ['p1'], imposterCounts: { p1: 2, p2: 1 } },
  };

  s = reduce(s, { type: 'REMOVE_PLAYER', playerId: 'p1' });

  assert.deepEqual(s.players.map((p) => p.name), ['Ben']);
  assert.deepEqual(s.scores, { p2: 2 }, 'their points went with them');
  assert.deepEqual(s.lastWinners, ['p2'], 'and they are no longer a winner of anything');
  assert.deepEqual(s.history.lastImposters, [], 'and the fairness history forgot them');
  assert.deepEqual(s.history.imposterCounts, { p2: 1 });
});

test('duplicate and empty names are rejected', () => {
  const s = withPlayers(['Ann']);
  assert.throws(() => reduce(s, { type: 'ADD_PLAYER', name: 'ann' }), GameError);
  assert.throws(() => reduce(s, { type: 'ADD_PLAYER', name: '   ' }), GameError);
});

test('a game needs at least three players', () => {
  const s = withPlayers(['Ann', 'Ben']);
  assert.throws(() => reduce(s, { type: 'START_GAME' }), GameError);
});

test('imposter count is capped so imposters can never start at parity', () => {
  assert.equal(maxImpostersFor(3), 1);
  assert.equal(maxImpostersFor(5), 2);
  assert.equal(maxImpostersFor(8), 3);
  const s = started(['Ann', 'Ben', 'Cal'], { imposterCount: 5 });
  assert.equal(s.imposterIds.length, 1);
});

/* dealing ---------------------------------------------------------- */

test('starting deals one word, the right number of imposters, and an order', () => {
  const s = started(FIVE, { imposterCount: 2 });
  assert.equal(s.phase, PHASE.REVEAL);
  assert.ok(s.secretWord);
  assert.ok(s.imposterWord);
  assert.notEqual(s.secretWord, s.imposterWord);
  assert.equal(s.imposterIds.length, 2);
  assert.equal(new Set(s.order).size, 5);
});

test('the same seed always deals the same game', () => {
  const a = started(FIVE, {}, 12345);
  const b = started(FIVE, {}, 12345);
  assert.deepEqual(a.imposterIds, b.imposterIds);
  assert.equal(a.secretWord, b.secretWord);
  assert.deepEqual(a.order, b.order);
});

test('crew see the real word, imposters see the decoy', () => {
  const s = started(FIVE);
  const imposter = s.imposterIds[0];
  const crew = s.players.find((p) => !s.imposterIds.includes(p.id)).id;
  assert.equal(viewFor(s, crew).word, s.secretWord);
  assert.equal(viewFor(s, crew).role, 'crew');
  assert.equal(viewFor(s, imposter).word, s.imposterWord);
  assert.equal(viewFor(s, imposter).role, 'imposter');
});

test('blank mode gives the imposter no word at all', () => {
  const s = started(FIVE, { decoyMode: DECOY.BLANK });
  assert.equal(viewFor(s, s.imposterIds[0]).word, null);
});

test('co-imposters know each other, crew know nobody', () => {
  const s = started(FIVE, { imposterCount: 2 });
  const [a] = s.imposterIds;
  assert.equal(viewFor(s, a).fellowImposters.length, 1);
  const crew = s.players.find((p) => !s.imposterIds.includes(p.id)).id;
  assert.equal(viewFor(s, crew).fellowImposters.length, 0);
});

test('the broadcast state leaks neither the word nor who the imposters are', () => {
  const s = revealAll(started(FIVE));
  const pub = publicState(s);
  assert.equal(pub.secretWord, null);
  assert.equal(pub.imposterWord, null);
  assert.deepEqual(pub.imposterIds, []);
});

// Nulling the answer is not enough on its own: the seed is the answer in one
// number. Everything else the deal consumes is public by design — the roster
// in its dealt order, the config, the pack ids — and the word lists ship in
// every client's own bundle, so a phone holding the seed can simply run the
// deal again and read the word and the imposters off its own screen. This
// test is the attack, not a field check: it replays the deal from nothing but
// the broadcast state and asserts it comes out wrong.
test('the broadcast state does not carry the seed, so the deal cannot be replayed', () => {
  const s = started(FIVE);
  const pub = publicState(s);
  assert.equal(pub.seed, null, 'the seed must never go out over the wire');

  // What an attacker would do with it. mulberry32(null) is mulberry32(0), so
  // this is the best guess available from the payload — and it must miss.
  const rng = mulberry32(pub.seed);
  const pool = poolFor(pub.config.wordLang, pub.config.packIds, pub.customPacks);
  const guessWord = pickWord(pool, rng, []).word;
  const guessImposters = pickImposters(
    pub.players.map((p) => p.id),
    resolveImposterCount(pub.config.imposterCount, pub.players.length, rng),
    rng,
    EMPTY_HISTORY,
  );

  assert.notEqual(guessWord, s.secretWord, 'the word was derivable from the broadcast');
  assert.notDeepEqual(
    [...guessImposters].sort(),
    [...s.imposterIds].sort(),
    'the imposters were derivable from the broadcast',
  );
});

test('live votes are hidden until the tally', () => {
  let s = clueRound(revealAll(started(FIVE)));
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p2' });
  const pub = publicState(s);
  assert.deepEqual(pub.votes, {});
  assert.equal(pub.votedSoFar, 1);
});

/* imposter count --------------------------------------------------- */

test('auto scales the imposter count with the table', () => {
  assert.equal(autoImposterCount(3), 1);
  assert.equal(autoImposterCount(5), 1);
  assert.equal(autoImposterCount(6), 2);
  assert.equal(autoImposterCount(8), 2);
  assert.equal(autoImposterCount(9), 3);
  assert.equal(autoImposterCount(12), 3);
  // never at or past parity with the crew
  for (let n = 3; n <= 12; n++) assert.ok(autoImposterCount(n) < n - autoImposterCount(n));
});

test('auto deals the number it promises', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
  for (const n of [3, 5, 6, 9]) {
    const s = started(names.slice(0, n), { imposterCount: IMPOSTERS_AUTO }, n);
    assert.equal(s.imposterIds.length, autoImposterCount(n));
  }
});

test('random stays inside the cap and does actually vary', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const counts = new Set();
  for (let seed = 0; seed < 80; seed++) {
    const s = started(names, { imposterCount: IMPOSTERS_RANDOM }, seed);
    assert.ok(s.imposterIds.length >= 1);
    assert.ok(s.imposterIds.length <= 3); // maxImpostersFor(7)
    counts.add(s.imposterIds.length);
  }
  assert.ok(counts.size > 1, 'random should not always deal the same number');
});

test('a random count is never written into the config, so it cannot leak', () => {
  const s = started(FIVE, { imposterCount: IMPOSTERS_RANDOM }, 9);
  assert.equal(s.config.imposterCount, IMPOSTERS_RANDOM);
  const pub = publicState(s);
  assert.equal(pub.imposterCount, null, 'the count must be hidden on random');
  assert.deepEqual(pub.imposterIds, []);
  assert.equal(pub.config.imposterCount, IMPOSTERS_RANDOM);
});

test('a known count is published, and the true count only at the end', () => {
  const s = started(FIVE, { imposterCount: 2 }, 9);
  assert.equal(publicState(s).imposterCount, 2);
  const over = { ...s, phase: PHASE.GAME_OVER };
  assert.equal(publicState(over).imposterCount, 2);
});

test('a fixed count is still capped by the table size', () => {
  assert.equal(resolveImposterCount(9, 3, () => 0), 1);
  assert.equal(resolveImposterCount(2, 5, () => 0), 2);
  assert.equal(resolveImposterCount('nonsense', 5, () => 0), 1);
});

/* decoy modes ------------------------------------------------------ */

test('blank deals no decoy at all', () => {
  const s = started(FIVE, { decoyMode: DECOY.BLANK });
  assert.equal(s.imposterWord, null);
  assert.equal(viewFor(s, s.imposterIds[0]).word, null);
});

test('related deals the pair’s near miss', () => {
  const s = started(FIVE, { decoyMode: DECOY.RELATED }, 4);
  assert.ok(s.imposterWord);
  assert.notEqual(s.imposterWord, s.secretWord);
  assert.equal(viewFor(s, s.imposterIds[0]).word, s.imposterWord);
});

test('unrelated deals a real word from another pack', () => {
  for (let seed = 0; seed < 40; seed++) {
    const s = started(FIVE, { decoyMode: DECOY.UNRELATED }, seed);
    assert.ok(s.imposterWord, 'should still get a word');
    assert.notEqual(s.imposterWord, s.secretWord);
    const pool = poolFor(s.config.wordLang, s.config.packIds);
    const source = pool.find((p) => p.word === s.imposterWord);
    assert.ok(source, `${s.imposterWord} should be a real word from the packs`);
    assert.notEqual(source.packId, s.packId, 'should come from a different pack');
  }
});

test('unrelated falls back sensibly when only one pack is in play', () => {
  const s = started(FIVE, { decoyMode: DECOY.UNRELATED, packIds: ['jobs'] }, 2);
  assert.ok(s.imposterWord);
  assert.notEqual(s.imposterWord, s.secretWord);
});

/* blind mode ------------------------------------------------------- */

test('blind mode tells nobody their role', () => {
  const s = started(FIVE, { imposterKnows: false });
  for (const p of s.players) {
    const view = viewFor(s, p.id);
    assert.equal(view.role, 'unknown', `${p.name} was told their role`);
    assert.deepEqual(view.fellowImposters, [], 'co-imposters must stay hidden too');
  }
});

test('blind mode still deals the odd word out', () => {
  const s = started(FIVE, { imposterKnows: false });
  const words = s.players.map((p) => viewFor(s, p.id).word);
  const odd = words.filter((w) => w === s.imposterWord);
  const same = words.filter((w) => w === s.secretWord);
  assert.equal(odd.length, s.imposterIds.length);
  assert.equal(same.length, 5 - s.imposterIds.length);
  assert.ok(words.every(Boolean), 'everyone must have a word in blind mode');
});

test('blind mode refuses a blank card, which would give the game away', () => {
  const s = started(FIVE, { imposterKnows: false, decoyMode: DECOY.BLANK });
  assert.equal(s.config.decoyMode, DECOY.RELATED);
  assert.ok(s.imposterWord, 'a blank card would identify the imposter instantly');
  // and the lobby shows the corrected setting rather than promising blank
  let lobby = withPlayers(FIVE, { decoyMode: DECOY.BLANK });
  lobby = reduce(lobby, { type: 'SET_CONFIG', config: { imposterKnows: false } });
  assert.equal(lobby.config.decoyMode, DECOY.RELATED);
});

test('blind mode switches calling off, since nobody knows who they are', () => {
  let lobby = withPlayers(FIVE, { allowCall: true });
  lobby = reduce(lobby, { type: 'SET_CONFIG', config: { imposterKnows: false } });
  assert.equal(lobby.config.allowCall, false);

  const s = revealAll(started(FIVE, { imposterKnows: false, allowCall: true }));
  assert.equal(canCall(s, s.imposterIds[0]), false);
  assert.throws(
    () => reduce(s, { type: 'CALL_WORD', playerId: s.imposterIds[0], text: s.secretWord }),
    (e) => e.code === 'callsOff',
  );
});

test('an imposter voted out in blind mode still gets their final guess', () => {
  const g = started(FIVE, { imposterKnows: false, imposterCount: 1, allowSteal: true }, 8);
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.STEAL);
  assert.equal(s.stealBy, g.imposterIds[0]);
  s = reduce(s, { type: 'STEAL_GUESS', text: g.secretWord });
  assert.equal(s.result.winner, 'imposters');
});

test('turning blind mode back off restores the settings it had locked', () => {
  let lobby = withPlayers(FIVE);
  lobby = reduce(lobby, { type: 'SET_CONFIG', config: { imposterKnows: false } });
  assert.equal(lobby.config.allowCall, false);
  lobby = reduce(lobby, { type: 'SET_CONFIG', config: { imposterKnows: true, allowCall: true } });
  assert.equal(lobby.config.allowCall, true);
  assert.equal(lobby.config.imposterKnows, true);
});

test('blind mode leaks nothing through the broadcast state either', () => {
  const s = revealAll(started(FIVE, { imposterKnows: false }));
  const pub = publicState(s);
  assert.deepEqual(pub.imposterIds, []);
  assert.equal(pub.secretWord, null);
  assert.equal(pub.imposterWord, null);
});

/* dealing fairly --------------------------------------------------- */

/**
 * Plays `games` deals in a row and reports what was dealt each time.
 *
 * `between` is how the table gets back to a fresh deal: tapping "Play again"
 * straight from the result, or ending the game and dealing from the lobby.
 * Both keep the same people, so both have to deal just as fairly.
 */
function deals(games, { packIds = [], imposterCount = 1, names = FIVE, between = 'PLAY_AGAIN' } = {}) {
  let s = withPlayers(names, { packIds, imposterCount });
  const words = [];
  const imposters = [];
  for (let g = 0; g < games; g++) {
    s = reduce(s, { type: 'START_GAME', seed: g * 7919 + 13 });
    words.push(s.secretWord);
    imposters.push([...s.imposterIds].sort().join('+'));
    s = reduce(s, { type: between });
  }
  return { words, imposters, state: s };
}

test('the same word is never dealt twice in a row', () => {
  for (const packIds of [[], ['jobs']]) {
    const { words } = deals(200, { packIds });
    const repeat = words.findIndex((w, i) => i > 0 && w === words[i - 1]);
    assert.equal(repeat, -1, `back-to-back repeat at game ${repeat} (${words[repeat]})`);
  }
});

test('the same person is never the imposter twice in a row', () => {
  for (const imposterCount of [1, 2]) {
    const { imposters } = deals(200, { imposterCount });
    for (let i = 1; i < imposters.length; i++) {
      const before = new Set(imposters[i - 1].split('+'));
      const now = imposters[i].split('+');
      for (const id of now) {
        assert.ok(!before.has(id), `${id} was imposter in games ${i - 1} and ${i}`);
      }
    }
  }
});

test('ending the game and dealing again is just as fair as playing again', () => {
  // The table used to be cleared here. Re-adding the same people minted new
  // ids, so the history pointed at players who no longer existed and the
  // rotation quietly started over every time a game was ended.
  const { words, imposters } = deals(200, { between: 'RESET' });
  for (let i = 1; i < words.length; i++) {
    assert.notEqual(words[i], words[i - 1], `the same word twice running at game ${i}`);
    const before = new Set(imposters[i - 1].split('+'));
    for (const id of imposters[i].split('+')) {
      assert.ok(!before.has(id), `${id} was imposter in games ${i - 1} and ${i}`);
    }
  }
});

test('a word does not come back until plenty of others have been dealt', () => {
  const { words } = deals(200, { packIds: ['jobs'] }); // the smallest pool: 100
  const lastSeen = new Map();
  let closest = Infinity;
  words.forEach((w, i) => {
    if (lastSeen.has(w)) closest = Math.min(closest, i - lastSeen.get(w));
    lastSeen.set(w, i);
  });
  assert.ok(closest >= 40, `a word came back after only ${closest} games`);
});

test('imposter turns are shared out far more evenly than chance would', () => {
  const { imposters } = deals(300);
  const counts = {};
  for (const id of imposters) counts[id] = (counts[id] || 0) + 1;
  const turns = Object.values(counts);
  assert.equal(turns.length, 5, 'everyone should get a turn');
  const spread = Math.max(...turns) - Math.min(...turns);
  // Uniform random over 300 games typically spreads by 25 or more; this
  // should stay far tighter without ever being strictly predictable.
  assert.ok(spread <= 15, `gap between most and least was ${spread}`);
});

test('who is picked stays unpredictable — the fairest player is not a certainty', () => {
  // Deal the same game repeatedly from a history where one player is well
  // behind. If the rule were "whoever is furthest behind", they would be
  // imposter every single time and could deduce their own role.
  const base = withPlayers(FIVE, { imposterCount: 1 });
  const history = {
    words: [],
    lastImposters: [],
    imposterCounts: { p1: 5, p2: 5, p3: 5, p4: 5, p5: 0 },
  };
  const picked = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const s = reduce({ ...base, history }, { type: 'START_GAME', seed });
    picked.add(s.imposterIds[0]);
  }
  assert.ok(picked.has('p5'), 'the player who is behind should be favoured');
  assert.ok(picked.size > 1, 'but never a certainty');
});

test('history survives playing again and ending the game', () => {
  let s = reduce(withPlayers(FIVE), { type: 'START_GAME', seed: 3 });
  const dealt = s.secretWord;
  const wasImposter = s.imposterIds[0];

  s = reduce(s, { type: 'PLAY_AGAIN' });
  assert.ok(s.history.words.includes(dealt), 'play again lost the word history');
  assert.deepEqual(s.history.lastImposters, [wasImposter]);

  s = reduce(s, { type: 'RESET' });
  assert.ok(s.history.words.includes(dealt), 'ending the game lost the history');
  assert.equal(s.players.length, FIVE.length, 'ending the game emptied the table');
  assert.deepEqual(s.history.lastImposters, [wasImposter], 'and lost who just played it');
  assert.equal(s.phase, PHASE.LOBBY);
});

test('every card names the pack the real word came from', () => {
  for (const decoyMode of [DECOY.RELATED, DECOY.UNRELATED, DECOY.BLANK, DECOY.HINT]) {
    const s = reduce(withPlayers(FIVE, { decoyMode }), { type: 'START_GAME', seed: 21 });
    const packs = FIVE.map((_, i) => viewFor(s, `p${i + 1}`).packId);
    assert.ok(s.packId, 'the game should know which pack it dealt from');
    for (const packId of packs) {
      // Including the imposter's. A 'way off' decoy is pulled from a
      // different pack on purpose, and naming THAT pack would put a wrong
      // category on one phone and the right one on every other.
      assert.equal(packId, s.packId, `${decoyMode}: a card named the wrong pack`);
    }
  }
});

test('the history never reaches the clients — it holds the word in play', () => {
  const s = reduce(withPlayers(FIVE), { type: 'START_GAME', seed: 11 });
  const pub = publicState(s);
  assert.ok(!('history' in pub), 'history must be stripped, not nulled');
  assert.ok(
    !JSON.stringify(pub).includes(s.secretWord),
    'the secret word appeared somewhere in the broadcast payload',
  );
});

test('a pool smaller than the history window still deals', () => {
  // Force a history that covers every word in a single pack.
  const pool = poolFor('en', ['jobs']).map((p) => p.word);
  const s = reduce(
    { ...withPlayers(FIVE, { packIds: ['jobs'] }), history: { ...EMPTY_HISTORY, words: pool } },
    { type: 'START_GAME', seed: 2 },
  );
  assert.ok(s.secretWord, 'should fall back to the whole pool rather than deal nothing');
});

test('dealing is still reproducible from a seed and a history', () => {
  const base = withPlayers(FIVE);
  const a = reduce(base, { type: 'START_GAME', seed: 99 });
  const b = reduce(base, { type: 'START_GAME', seed: 99 });
  assert.equal(a.secretWord, b.secretWord);
  assert.deepEqual(a.imposterIds, b.imposterIds);
});

/* word packs ------------------------------------------------------- */

test('every language ships ten packs of a hundred pairs', () => {
  for (const lang of ['en', 'th', 'de']) {
    const packs = packsFor(lang);
    assert.equal(packs.length, 10, `${lang} should have 10 packs`);
    for (const p of packs) {
      assert.equal(p.pairs.length, 100, `${lang}/${p.id} should have 100 pairs`);
      assert.ok(p.name && p.emoji && p.hint, `${lang}/${p.id} is missing a label`);
    }
    assert.equal(poolFor(lang, []).length, 1000);
  }
});

test('no word is dealt twice within a language, and none equals its decoy', () => {
  for (const lang of ['en', 'th', 'de']) {
    const seen = new Map();
    for (const pair of poolFor(lang, [])) {
      assert.ok(pair.word.trim() && pair.decoy.trim(), `${lang}: empty side`);
      assert.notEqual(pair.word, pair.decoy, `${lang}: ${pair.word} is its own decoy`);
      const prev = seen.get(pair.word);
      assert.ok(!prev, `${lang}: "${pair.word}" appears in both ${prev} and ${pair.packId}`);
      seen.set(pair.word, pair.packId);
    }
  }
});

test('every pair carries the hint line its pack promises', () => {
  for (const lang of ['en', 'th', 'de']) {
    for (const pair of poolFor(lang, [])) {
      assert.ok(pair.hint, `${lang}/${pair.packId}: ${pair.word} has no hint`);
    }
  }
});

test('Thai vowel and tone marks survive normalisation', () => {
  // These differ only by a mark. Dropping marks made brown rice the same
  // word as a lunchbox, which let a wrong final guess win the game.
  const g = started(FIVE, { wordLang: 'th', imposterCount: 1, allowSteal: true }, 5);
  const play = (guess) => {
    let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
    s = reduce(s, { type: 'CONTINUE' });
    return reduce(s, { type: 'STEAL_GUESS', text: guess }).result.winner;
  };
  assert.equal(play(g.secretWord), 'imposters', 'the exact word must still win');
  const marksStripped = g.secretWord.normalize('NFD').replace(/\p{M}/gu, '');
  if (marksStripped !== g.secretWord) {
    assert.equal(play(marksStripped), 'crew', 'a mark-stripped guess must not count');
  }
});

test('a word typed without its accent is still the word', () => {
  // A plain keyboard gives you "Cafe", not "Café". Before this, the game
  // called that wrong — and in a round where calling the word can lose it,
  // being told you are wrong because of an accent is not a small thing.
  // Three shipped words were affected: Crêpe, Café and Pokémon.
  for (const [onTheCard, typed] of [
    ['Café', 'Cafe'],
    ['Crêpe', 'Crepe'],
    ['Pokémon', 'Pokemon'],
    ['Spätzle', 'Spatzle'],
    ['Weißbier', 'Weissbier'],
  ]) {
    assert.equal(normalise(onTheCard), normalise(typed), `${onTheCard} / ${typed}`);
  }
});

test('but a Thai mark is not an accent, and still makes a different word', () => {
  // The same fold, applied to Thai, would make a lunchbox the same as brown
  // rice. It comes off Latin letters only.
  assert.notEqual(normalise('ข้าวกล้อง'), normalise('ข้าวกล่อง'));
  assert.notEqual(normalise('ถังขยะ'), normalise('ถุงขยะ'));
});

test('two Thai words that differ only by a mark are treated as different', () => {
  const s = revealAll({
    ...started(FIVE, { wordLang: 'th' }, 1),
    secretWord: 'ข้าวกล้อง',
  });
  const turn = currentTurn(s);
  const after = reduce(s, { type: 'SUBMIT_CLUE', playerId: turn, text: 'ข้าวกล่อง' });
  assert.equal(after.clues.length, 1, 'a lunchbox is not brown rice');
});

/* rounds ----------------------------------------------------------- */

test('each round asks everyone still in for one more clue', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 1, maxRounds: 4 }, 12);
  const crew = g.players.filter((p) => !g.imposterIds.includes(p.id));

  let s = clueRound(revealAll(g));
  assert.equal(s.clues.filter((c) => c.round === 1).length, 7);

  s = reduce(voteOut(s, crew[0].id), { type: 'CONTINUE' });
  if (s.phase === PHASE.STEAL) s = reduce(s, { type: 'STEAL_GUESS', text: 'no' });
  assert.equal(s.phase, PHASE.CLUES);
  assert.equal(s.round, 2);

  s = clueRound(s);
  // One fewer speaker, and the first round's clues are still on the table
  assert.equal(s.clues.filter((c) => c.round === 2).length, 6);
  assert.equal(s.clues.filter((c) => c.round === 1).length, 7);
  assert.equal(s.clues.length, 13);
});

test('a set number of rounds still ends the game on time', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 1, maxRounds: 2 }, 3);
  const crew = g.players.filter((p) => !g.imposterIds.includes(p.id));
  let s = revealAll(g);
  for (let i = 0; i < 2; i++) {
    s = reduce(voteOut(clueRound(s), crew[i].id), { type: 'CONTINUE' });
    if (s.phase === PHASE.STEAL) s = reduce(s, { type: 'STEAL_GUESS', text: 'no' });
  }
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.reason, 'time');
});

test('unlimited keeps going past where a fixed game would have stopped', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], {
    imposterCount: 1,
    maxRounds: ROUNDS_UNLIMITED,
    allowSteal: false,
  }, 3);
  const crew = g.players.filter((p) => !g.imposterIds.includes(p.id));
  let s = revealAll(g);
  // Vote out three crew members: a 2-round game would have timed out by now
  for (let i = 0; i < 3; i++) {
    s = reduce(voteOut(clueRound(s), crew[i].id), { type: 'CONTINUE' });
  }
  assert.equal(s.phase, PHASE.CLUES);
  assert.equal(s.round, 4);
  assert.equal(s.result, null, 'nobody has won on time');
});

test('unlimited ends the moment the imposters are caught', () => {
  const g = started(FIVE, { imposterCount: 1, maxRounds: ROUNDS_UNLIMITED, allowSteal: false }, 5);
  let s = reduce(voteOut(clueRound(revealAll(g)), g.imposterIds[0]), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'crew');
});

test('unlimited still terminates even if the table ties every single vote', () => {
  // Nobody is ever eliminated, so only the backstop can end this.
  let s = revealAll(started(FIVE, { maxRounds: ROUNDS_UNLIMITED }, 2));
  let guard = 0;
  while (s.phase !== PHASE.GAME_OVER) {
    if (guard++ > 500) assert.fail('an unlimited game ran away');
    if (s.phase === PHASE.CLUES) {
      s = reduce(s, { type: 'SUBMIT_CLUE', playerId: currentTurn(s), text: `w${guard}` });
    } else if (s.phase === PHASE.VOTE) {
      s = reduce(s, { type: 'DECLARE_ELIMINATION', playerId: null }); // always a tie
    } else if (s.phase === PHASE.VERDICT) {
      s = reduce(s, { type: 'CONTINUE' });
    }
  }
  assert.equal(s.round, SAFETY_ROUNDS);
  assert.equal(s.result.reason, 'time');
});

/* hint mode -------------------------------------------------------- */

test('hint mode gives the imposter a description instead of a word', () => {
  const s = started(FIVE, { decoyMode: DECOY.HINT }, 4);
  assert.equal(s.imposterWord, null, 'there should be no decoy word at all');
  const view = viewFor(s, s.imposterIds[0]);
  assert.equal(view.word, null);
  assert.ok(view.hint, 'the imposter should have a hint');
  assert.ok(view.hint.text, 'the hint should name the kind of thing');
  assert.ok(view.hint.chars > 0);
  assert.ok(view.hint.words >= 1);
});

test('the hint describes the real word, and never contains it', () => {
  for (let seed = 0; seed < 60; seed++) {
    const s = started(FIVE, { decoyMode: DECOY.HINT }, seed);
    const { hint } = viewFor(s, s.imposterIds[0]);
    const secret = s.secretWord;
    assert.ok(
      !hint.text.toLowerCase().includes(secret.toLowerCase()),
      `hint gave away "${secret}": ${hint.text}`,
    );
    assert.equal(hint.words, secret.trim().split(/\s+/).length);
    assert.equal(hint.chars, [...secret].filter((c) => !/\s/.test(c)).length);
  }
});

test('the crew are never given the hint', () => {
  const s = started(FIVE, { decoyMode: DECOY.HINT });
  for (const p of s.players) {
    if (s.imposterIds.includes(p.id)) continue;
    const view = viewFor(s, p.id);
    assert.equal(view.hint, null, 'the crew already know the word');
    assert.equal(view.word, s.secretWord);
  }
});

test('the hint does not reach the shared state until the game is over', () => {
  const s = revealAll(started(FIVE, { decoyMode: DECOY.HINT }));
  assert.equal(publicState(s).imposterHint, null);
  assert.ok(publicState({ ...s, phase: PHASE.GAME_OVER }).imposterHint);
});

test('every language counts Thai and German words sensibly in a hint', () => {
  for (const lang of ['en', 'th', 'de']) {
    for (let seed = 0; seed < 30; seed++) {
      const s = started(FIVE, { wordLang: lang, decoyMode: DECOY.HINT }, seed);
      const { hint } = viewFor(s, s.imposterIds[0]);
      assert.ok(hint.text, `${lang} pack is missing a hint`);
      // A character count that ignores spaces should match what a player sees
      assert.equal(hint.chars, s.secretWord.replace(/\s/g, '').length);
      assert.ok(hint.chars >= 2, `${lang} seed ${seed}: ${s.secretWord} -> ${hint.chars}`);
    }
  }
});

test('blind mode refuses hint mode too, for the same reason as blank', () => {
  const s = started(FIVE, { imposterKnows: false, decoyMode: DECOY.HINT });
  assert.equal(s.config.decoyMode, DECOY.RELATED);
  assert.ok(s.imposterWord, 'blind mode must deal an ordinary-looking word');
  assert.equal(s.imposterHint, null);

  let lobby = withPlayers(FIVE, { decoyMode: DECOY.HINT });
  lobby = reduce(lobby, { type: 'SET_CONFIG', config: { imposterKnows: false } });
  assert.equal(lobby.config.decoyMode, DECOY.RELATED);
});

test('an imposter on a hint can still call and steal', () => {
  const g = revealAll(started(FIVE, { decoyMode: DECOY.HINT, allowCall: true }, 7));
  assert.equal(canCall(g, g.imposterIds[0]), true);
  const s = reduce(g, {
    type: 'CALL_WORD',
    playerId: g.imposterIds[0],
    text: g.secretWord,
  });
  assert.equal(s.result.winner, 'imposters');
});

/* calling the word ------------------------------------------------- */

test('only a live imposter may call, and only during the clues', () => {
  const g = started(FIVE);
  const imposter = g.imposterIds[0];
  const crew = g.players.find((p) => !g.imposterIds.includes(p.id)).id;

  assert.equal(canCall(g, imposter), false, 'not during the reveal');
  const s = revealAll(g);
  assert.equal(canCall(s, imposter), true);
  assert.equal(canCall(s, crew), false);

  assert.throws(
    () => reduce(s, { type: 'CALL_WORD', playerId: crew, text: s.secretWord }),
    (e) => e.code === 'notImposter',
  );
  const out = { ...s, eliminated: [imposter] };
  assert.throws(
    () => reduce(out, { type: 'CALL_WORD', playerId: imposter, text: 'x' }),
    (e) => e.code === 'deadVoter',
  );
});

test('calling the word correctly wins it there and then', () => {
  const g = revealAll(started(FIVE));
  const s = reduce(g, {
    type: 'CALL_WORD',
    playerId: g.imposterIds[0],
    text: ` ${g.secretWord.toUpperCase()} `,
  });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'called');
  assert.equal(s.call.correct, true);
});

test('calling wrong takes that imposter out and the round carries on', () => {
  // Two imposters, so one calling wrong should not end it for the other.
  const g = revealAll(started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 2 }, 3));
  const [first, second] = g.imposterIds;
  let s = reduce(g, { type: 'CALL_WORD', playerId: first, text: 'nowhere near it' });

  assert.equal(s.phase, PHASE.VERDICT);
  assert.equal(s.lastVote.eliminatedId, first);
  assert.equal(s.lastVote.called, true);
  assert.ok(s.eliminated.includes(first));

  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.CLUES, 'the other imposter plays on');
  assert.ok(!s.eliminated.includes(second));
});

test('an imposter who called wrong gets no second guess', () => {
  const g = revealAll(started(FIVE, { imposterCount: 1, allowSteal: true }));
  let s = reduce(g, { type: 'CALL_WORD', playerId: g.imposterIds[0], text: 'not the word' });
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER, 'no steal — they already had their guess');
  assert.equal(s.result.winner, 'crew');
});

test('calling can be switched off', () => {
  const g = revealAll(started(FIVE, { allowCall: false }));
  assert.equal(canCall(g, g.imposterIds[0]), false);
  assert.throws(
    () => reduce(g, { type: 'CALL_WORD', playerId: g.imposterIds[0], text: g.secretWord }),
    (e) => e.code === 'callsOff',
  );
});

/* the final guess -------------------------------------------------- */

test('any imposter voted out gets a final guess, not just the last one', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 2, allowSteal: true }, 6);
  const [first, second] = g.imposterIds;
  let s = voteOut(clueRound(revealAll(g)), first);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.STEAL, 'the first one caught still gets a guess');
  assert.equal(s.stealBy, first);
  assert.ok(!s.eliminated.includes(second));
});

test('a correct final guess wins even with a partner still in play', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 2, allowSteal: true }, 6);
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(reduce(s, { type: 'CONTINUE' }), { type: 'STEAL_GUESS', text: g.secretWord });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'steal');
});

test('a wrong final guess just carries on with the round', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 2, allowSteal: true }, 6);
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(reduce(s, { type: 'CONTINUE' }), { type: 'STEAL_GUESS', text: 'wrong' });
  assert.equal(s.phase, PHASE.CLUES);
  assert.equal(s.round, 2);
  assert.equal(s.stealBy, null);
});

test('only the player who was just voted out may make the final guess', () => {
  const g = started(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { imposterCount: 2, allowSteal: true }, 6);
  const [first, second] = g.imposterIds;
  let s = reduce(voteOut(clueRound(revealAll(g)), first), { type: 'CONTINUE' });
  assert.throws(
    () => reduce(s, { type: 'STEAL_GUESS', playerId: second, text: g.secretWord }),
    (e) => e.code === 'notImposter',
  );
});

/* languages -------------------------------------------------------- */

test('the word language decides which pack the word comes from', () => {
  for (const [lang, sample] of [
    ['en', /^[\x20-\x7e]+$/], // plain ASCII
    ['th', /[฀-๿]/], // Thai script
    ['de', /^[\wÄÖÜäöüß\s.,!?-]+$/u],
  ]) {
    const s = started(FIVE, { wordLang: lang }, 7);
    assert.match(s.secretWord, sample, `${lang}: ${s.secretWord}`);
    assert.match(s.imposterWord, sample, `${lang}: ${s.imposterWord}`);
  }
});

test('every language deals a word and a different decoy from every seed', () => {
  for (const lang of ['en', 'th', 'de']) {
    for (let seed = 0; seed < 60; seed++) {
      const s = started(FIVE, { wordLang: lang }, seed);
      assert.ok(s.secretWord, `${lang} seed ${seed} dealt no word`);
      assert.ok(s.imposterWord, `${lang} seed ${seed} dealt no decoy`);
      assert.notEqual(s.secretWord, s.imposterWord);
    }
  }
});

test('switching the word language clears a pack selection from the old one', () => {
  let s = withPlayers(FIVE);
  s = reduce(s, { type: 'SET_CONFIG', config: { packIds: ['thailand', 'food'] } });
  assert.equal(s.config.packIds.length, 2);
  s = reduce(s, { type: 'SET_CONFIG', config: { wordLang: 'de' } });
  assert.deepEqual(s.config.packIds, []);
});

test('a pack id that does not exist in this language still deals a word', () => {
  // 'thailand' only exists in the English packs.
  const s = started(FIVE, { wordLang: 'de', packIds: ['thailand'] }, 3);
  assert.ok(s.secretWord);
});

test('the steal comparison ignores case, spacing and punctuation in any script', () => {
  const play = (lang, guess, mutate) => {
    const g = started(FIVE, { wordLang: lang, imposterCount: 1, allowSteal: true }, 11);
    let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
    s = reduce(s, { type: 'CONTINUE' });
    return reduce(s, { type: 'STEAL_GUESS', text: mutate(g.secretWord) }).result.winner;
  };
  assert.equal(play('en', null, (w) => ` ${w.toUpperCase()}! `), 'imposters');
  assert.equal(play('th', null, (w) => ` ${w} `), 'imposters');
  assert.equal(play('de', null, (w) => w.toLowerCase()), 'imposters');
  assert.equal(play('de', null, () => 'etwas anderes'), 'crew');
});

test('Thai words keep their tone marks through normalisation', () => {
  // Stripping combining marks would turn these into the same string, which
  // would let a wrong guess win.
  const g = started(FIVE, { wordLang: 'th', imposterCount: 1, allowSteal: true }, 5);
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  const stripped = g.secretWord.normalize('NFD').replace(/\p{M}/gu, '');
  if (stripped !== g.secretWord) {
    const out = reduce(s, { type: 'STEAL_GUESS', text: stripped });
    assert.equal(out.result.winner, 'crew', 'a mark-stripped guess must not count');
  }
});

/* reveal ----------------------------------------------------------- */

test('the clue phase starts only once every player has seen their card', () => {
  let s = started(FIVE);
  for (const p of s.players.slice(0, 4)) {
    s = reduce(s, { type: 'MARK_REVEALED', playerId: p.id });
    assert.equal(s.phase, PHASE.REVEAL);
  }
  s = reduce(s, { type: 'MARK_REVEALED', playerId: s.players[4].id });
  assert.equal(s.phase, PHASE.CLUES);
});

test('looking twice does not count twice', () => {
  let s = started(FIVE);
  s = reduce(s, { type: 'MARK_REVEALED', playerId: 'p1' });
  s = reduce(s, { type: 'MARK_REVEALED', playerId: 'p1' });
  assert.equal(s.revealed.length, 1);
});

/* clues ------------------------------------------------------------ */

test('clues must be taken in turn', () => {
  const s = revealAll(started(FIVE));
  const turn = currentTurn(s);
  const notTurn = s.players.find((p) => p.id !== turn).id;
  assert.throws(() => reduce(s, { type: 'SUBMIT_CLUE', playerId: notTurn, text: 'hi' }), GameError);
});

test('a clue is one word, and never the secret word itself', () => {
  const s = revealAll(started(FIVE));
  const turn = currentTurn(s);
  assert.throws(() => reduce(s, { type: 'SUBMIT_CLUE', playerId: turn, text: 'two words' }), GameError);
  assert.throws(() => reduce(s, { type: 'SUBMIT_CLUE', playerId: turn, text: '' }), GameError);
  assert.throws(
    () => reduce(s, { type: 'SUBMIT_CLUE', playerId: turn, text: s.secretWord }),
    GameError,
  );
});

test('a clue cannot repeat one already given', () => {
  let s = revealAll(started(FIVE));
  s = reduce(s, { type: 'SUBMIT_CLUE', playerId: currentTurn(s), text: 'round' });
  assert.throws(
    () => reduce(s, { type: 'SUBMIT_CLUE', playerId: currentTurn(s), text: 'Round!' }),
    (err) => err.code === 'clueTaken',
  );
});

test('errors carry a code and its parameters, not a sentence', () => {
  const s = withPlayers(['Ann']);
  try {
    reduce(s, { type: 'ADD_PLAYER', name: 'Ann' });
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err instanceof GameError);
    assert.equal(err.code, 'duplicateName');
    assert.deepEqual(err.params, { name: 'Ann' });
  }
});

test('voting opens once everyone has given a clue', () => {
  const s = clueRound(revealAll(started(FIVE)));
  assert.equal(s.phase, PHASE.VOTE);
  assert.equal(s.clues.length, 5);
});

test('a different player opens each round', () => {
  const s = revealAll(started(FIVE));
  const first = speakingOrder(s)[0];
  const second = speakingOrder({ ...s, round: 2 })[0];
  assert.notEqual(first, second);
});

test('the host can cut the clue phase short', () => {
  let s = revealAll(started(FIVE));
  s = reduce(s, { type: 'FORCE_VOTE' });
  assert.equal(s.phase, PHASE.VOTE);
});

/* voting ----------------------------------------------------------- */

test('you cannot vote for yourself, and the dead do not vote', () => {
  const s = clueRound(revealAll(started(FIVE)));
  assert.throws(() => reduce(s, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p1' }), GameError);
  const out = { ...s, eliminated: ['p1'] };
  assert.throws(() => reduce(out, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p2' }), GameError);
});

test('changing your vote replaces it rather than adding one', () => {
  let s = clueRound(revealAll(started(FIVE)));
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p2' });
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p3' });
  assert.equal(Object.keys(s.votes).length, 1);
  assert.equal(s.votes.p1, 'p3');
  assert.equal(pendingVoters(s).length, 4);
});

test('the verdict lands once the last vote is in', () => {
  const s = voteOut(clueRound(revealAll(started(FIVE))), 'p2');
  assert.equal(s.phase, PHASE.VERDICT);
  assert.equal(s.lastVote.eliminatedId, 'p2');
  assert.equal(s.eliminated.length, 1);
});

test('a tied vote eliminates nobody', () => {
  let s = clueRound(revealAll(started(FIVE, { imposterCount: 1 })));
  // p1<-p2, p2<-p1, p3<-p4, p4<-p3, p5<-p1  => p1:2, p2:1, p3:1, p4:1 ... make a clean 2-2 tie
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p1', targetId: 'p3' });
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p2', targetId: 'p3' });
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p3', targetId: 'p4' });
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p4', targetId: 'p5' });
  s = reduce(s, { type: 'CAST_VOTE', voterId: 'p5', targetId: 'p4' });
  assert.equal(s.phase, PHASE.VERDICT);
  assert.equal(s.lastVote.tied, true);
  assert.equal(s.lastVote.eliminatedId, null);
  assert.equal(s.eliminated.length, 0);
});

test('a show-of-hands elimination reaches the same verdict as a ballot', () => {
  const g = started(FIVE, { imposterCount: 1 });
  let s = clueRound(revealAll(g));
  s = reduce(s, { type: 'DECLARE_ELIMINATION', playerId: g.imposterIds[0] });
  assert.equal(s.phase, PHASE.VERDICT);
  assert.equal(s.lastVote.wasImposter, true);
  assert.equal(s.lastVote.declared, true);
  assert.deepEqual(s.eliminated, [g.imposterIds[0]]);
});

test('a show-of-hands round can also eliminate nobody', () => {
  let s = clueRound(revealAll(started(FIVE)));
  s = reduce(s, { type: 'DECLARE_ELIMINATION', playerId: null });
  assert.equal(s.lastVote.tied, true);
  assert.equal(s.eliminated.length, 0);
  assert.equal(reduce(s, { type: 'CONTINUE' }).phase, PHASE.CLUES);
});

/* win conditions --------------------------------------------------- */

test('catching the only imposter wins it for the crew (via the steal card)', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: true });
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  assert.equal(s.lastVote.wasImposter, true);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.STEAL);
  s = reduce(s, { type: 'STEAL_GUESS', text: 'definitely not it' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'crew');
});

test('a caught imposter who names the word steals the win', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: true });
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  s = reduce(s, { type: 'STEAL_GUESS', text: ` ${g.secretWord.toUpperCase()}! ` });
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'steal');
});

test('with the steal turned off, catching the imposter ends it immediately', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: false });
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'crew');
});

test('imposters win as soon as they match the crew in numbers', () => {
  // 3 players, 1 imposter: voting out one crew member leaves 1 v 1.
  const g = started(['Ann', 'Ben', 'Cal'], { imposterCount: 1 });
  const crew = g.players.find((p) => !g.imposterIds.includes(p.id)).id;
  let s = voteOut(clueRound(revealAll(g)), crew);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'outnumbered');
});

test('the game runs another round when nobody has won yet', () => {
  const g = started(FIVE, { imposterCount: 1 });
  const crew = g.players.filter((p) => !g.imposterIds.includes(p.id));
  let s = voteOut(clueRound(revealAll(g)), crew[0].id);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.CLUES);
  assert.equal(s.round, 2);
  assert.equal(speakingOrder(s).length, 4); // the eliminated player is skipped
});

test('imposters win on time if the crew never catch them', () => {
  const g = started(FIVE, { imposterCount: 1, maxRounds: 2 });
  let s = revealAll(g);
  const crew = g.players.filter((p) => !g.imposterIds.includes(p.id));
  s = reduce(voteOut(clueRound(s), crew[0].id), { type: 'CONTINUE' }); // round 1
  assert.equal(s.round, 2);
  s = reduce(voteOut(clueRound(s), crew[1].id), { type: 'CONTINUE' }); // round 2 -> parity or time
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'imposters');
});

test('the full word and roles are revealed only when the game is over', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: false });
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  const pub = publicState(s);
  assert.equal(pub.secretWord, g.secretWord);
  assert.deepEqual(pub.imposterIds, g.imposterIds);
});

/* replay ----------------------------------------------------------- */

test('play again keeps the players and re-deals everything else', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: false });
  let s = reduce(voteOut(clueRound(revealAll(g)), g.imposterIds[0]), { type: 'CONTINUE' });
  s = reduce(s, { type: 'PLAY_AGAIN' });
  assert.equal(s.phase, PHASE.LOBBY);
  assert.equal(s.players.length, 5);
  assert.equal(s.clues.length, 0);
  assert.equal(s.eliminated.length, 0);
  assert.equal(s.secretWord, null);
  assert.equal(s.gamesPlayed, 1);
});


/* the optional roles ----------------------------------------------- */

const SEVEN = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus'];
const roleIds = (s, role) => s.players.map((p) => p.id).filter((id) => roleOf(s, id) === role);
const one = (s, role) => roleIds(s, role)[0];

test('a role is only dealt while enough plain crew would be left', () => {
  // Five players, one imposter: four others, and every role dealt takes one
  // of them. Two have to stay ordinary or there is no game left to play.
  const small = started(FIVE, { imposterCount: 1, roles: SPECIAL_ROLES }, 4);
  assert.equal(Object.keys(small.roles).length, 2, 'five players should take two roles');
  assert.equal(roleIds(small, ROLE.CREW).length, PLAIN_CREW_FLOOR);

  const big = started(SEVEN, { imposterCount: 1, roles: SPECIAL_ROLES }, 4);
  assert.equal(Object.keys(big.roles).length, 3, 'seven players have room for all three');

  // and nobody is dealt two things
  const dealt = Object.keys(big.roles);
  assert.equal(new Set(dealt).size, dealt.length);
  for (const id of dealt) assert.ok(!big.imposterIds.includes(id), 'an imposter was dealt a role');
});

test('only the roles asked for are dealt', () => {
  const s = started(SEVEN, { roles: [ROLE.JESTER] }, 8);
  assert.deepEqual(Object.values(s.roles), [ROLE.JESTER]);
  const none = started(SEVEN, {}, 8);
  assert.deepEqual(none.roles, {}, 'no roles unless the table asks for them');
});

test('the detective is told one name, and it is a real one', () => {
  const s = started(SEVEN, { imposterCount: 2, roles: [ROLE.DETECTIVE] }, 12);
  const detective = one(s, ROLE.DETECTIVE);
  const view = viewFor(s, detective);
  assert.equal(view.role, ROLE.DETECTIVE);
  assert.equal(view.word, s.secretWord, 'the detective is crew and has the word');
  assert.ok(view.cleared, 'the detective should be told somebody');
  const cleared = s.players.find((p) => p.name === view.cleared);
  assert.ok(cleared, 'the name should belong to somebody at the table');
  assert.ok(!isImposter(s, cleared.id), 'the detective was cleared an imposter');
  assert.equal(roleOf(s, cleared.id), ROLE.CREW, 'the one certainty should be plain crew');
  assert.notEqual(cleared.id, detective, 'being told about yourself is not information');

  // and nobody else is told any of it
  for (const p of s.players) {
    if (p.id === detective) continue;
    assert.equal(viewFor(s, p.id).cleared, null, `${p.name} was told the detective's name`);
  }
});

test('the sidekick knows the imposters, has the real word, and is not one', () => {
  const s = started(SEVEN, { imposterCount: 1, roles: [ROLE.SIDEKICK] }, 3);
  const sidekick = one(s, ROLE.SIDEKICK);
  const view = viewFor(s, sidekick);
  assert.equal(view.word, s.secretWord, 'the sidekick sounds like crew because they are');
  assert.deepEqual(
    view.knownImposters.sort(),
    s.imposterIds.map((id) => playerById(s, id).name).sort(),
  );
  assert.ok(!isImposter(s, sidekick), 'the sidekick is not an imposter');
  assert.ok(isImposterSide(s, sidekick), 'but they play for that side');
  for (const p of s.players) {
    if (p.id === sidekick) continue;
    assert.deepEqual(viewFor(s, p.id).knownImposters, [], `${p.name} was handed the answer`);
  }
});

test('the jester wins by being voted out, and it ends there', () => {
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.JESTER], allowSteal: true }, 6));
  const jester = one(s, ROLE.JESTER);
  assert.equal(viewFor(s, jester).word, s.secretWord, 'the jester has the real word to play with');

  s = reduce(voteOut(clueRound(s), jester), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'jester');
  assert.equal(s.result.reason, 'jester');
});

test('a jester voted out is not offered a final guess', () => {
  // The final guess belongs to an imposter who has been caught. The jester
  // has already won and there is nothing left to steal.
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.JESTER], allowSteal: true }, 9));
  s = reduce(voteOut(clueRound(s), one(s, ROLE.JESTER)), { type: 'CONTINUE' });
  assert.notEqual(s.phase, PHASE.STEAL);
  assert.equal(s.result.winner, 'jester');
});

test('the crew still win by catching every imposter, sidekick or not', () => {
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.SIDEKICK], allowSteal: false }, 7));
  s = reduce(voteOut(clueRound(s), s.imposterIds[0]), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'crew', 'a sidekick left over does not keep the game alive');
});

test('the sidekick counts towards taking the table over', () => {
  // Seven players: one imposter and one sidekick against five. Each vote
  // that takes one of the five brings the sides closer, and at 2 against 2
  // the imposter side has it — one vote sooner than without the sidekick,
  // which is exactly what they are for.
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.SIDEKICK], allowSteal: false, maxRounds: ROUNDS_UNLIMITED }, 15));
  const sidekick = one(s, ROLE.SIDEKICK);
  const crew = s.players
    .map((p) => p.id)
    .filter((id) => !isImposterSide(s, id));
  s = reduce(voteOut(clueRound(s), crew[0]), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.CLUES, 'four against two is not over yet');
  s = reduce(voteOut(clueRound(s), crew[1]), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.CLUES, 'nor is three against two');
  s = reduce(voteOut(clueRound(s), crew[2]), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.GAME_OVER);
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'outnumbered');
  assert.ok(isImposterSide(s, sidekick));
});

test('blind mode deals no roles at all', () => {
  const s = started(SEVEN, { imposterKnows: false, roles: SPECIAL_ROLES }, 5);
  assert.deepEqual(s.roles, {}, 'a jester who does not know is just unlucky');
  assert.deepEqual(s.config.roles, []);
  for (const p of s.players) assert.equal(viewFor(s, p.id).role, 'unknown');
});

test('who was dealt what never reaches the other phones', () => {
  const s = started(SEVEN, { imposterCount: 1, allowSteal: false, roles: SPECIAL_ROLES }, 11);
  const pub = publicState(s);
  assert.deepEqual(pub.roles, {}, 'the role map was broadcast');
  assert.equal(pub.clearedId, null, "the detective's name was broadcast");

  let over = reduce(voteOut(clueRound(revealAll(s)), s.imposterIds[0]), { type: 'CONTINUE' });
  while (over.phase === PHASE.VERDICT) over = reduce(over, { type: 'CONTINUE' });
  assert.equal(over.phase, PHASE.GAME_OVER);
  assert.deepEqual(publicState(over).roles, s.roles, 'everything is on the table at the end');
});

/* scoring ----------------------------------------------------------- */

test('nobody is keeping score unless the table asked', () => {
  let s = revealAll(started(FIVE, { allowSteal: false }, 2));
  s = reduce(voteOut(clueRound(s), s.imposterIds[0]), { type: 'CONTINUE' });
  assert.equal(s.result.winner, 'crew');
  assert.deepEqual(s.scores, {}, 'scoring is off by default');
});

test('catching the imposter is a point for every crew member still in', () => {
  let s = revealAll(started(FIVE, { imposterCount: 1, allowSteal: false, scoring: true, maxRounds: ROUNDS_UNLIMITED }, 21));
  const imposter = s.imposterIds[0];
  const crew = s.players.map((p) => p.id).filter((id) => id !== imposter);

  // one crew member is voted out along the way, and misses out
  s = reduce(voteOut(clueRound(s), crew[0]), { type: 'CONTINUE' });
  s = reduce(voteOut(clueRound(s), imposter), { type: 'CONTINUE' });
  assert.equal(s.result.winner, 'crew');
  assert.equal(s.result.reason, 'caught', 'they lost somebody, so it was not a clean sweep');
  assert.equal(s.scores[crew[0]], undefined, 'a crew member who was voted out scores nothing');
  for (const id of crew.slice(1))
    assert.equal(s.scores[id], WIN_POINTS.caught, 'every survivor is paid for the path');
  assert.equal(s.scores[imposter], undefined);
});

test('the imposters score whether or not they survived it', () => {
  let s = revealAll(started(FIVE, { imposterCount: 1, allowSteal: true, scoring: true }, 31));
  const imposter = s.imposterIds[0];
  s = reduce(voteOut(clueRound(s), imposter), { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.STEAL);
  s = reduce(s, { type: 'STEAL_GUESS', text: s.secretWord });
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.result.reason, 'steal');
  assert.equal(s.scores[imposter], WIN_POINTS.steal, 'caught, guessed right, won, scored');
});

test('when the jester wins, the jester alone scores', () => {
  let s = revealAll(started(SEVEN, { roles: [ROLE.JESTER], scoring: true }, 6));
  const jester = one(s, ROLE.JESTER);
  s = reduce(voteOut(clueRound(s), jester), { type: 'CONTINUE' });
  assert.equal(s.result.winner, 'jester');
  assert.deepEqual(Object.keys(s.scores), [jester]);
  assert.equal(s.scores[jester], WIN_POINTS.jester, 'the hardest road pays the most');
});

test('the sidekick is paid with the imposters', () => {
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.SIDEKICK], scoring: true, allowSteal: false, maxRounds: ROUNDS_UNLIMITED }, 15));
  const sidekick = one(s, ROLE.SIDEKICK);
  const crew = s.players.map((p) => p.id).filter((id) => !isImposterSide(s, id));
  for (const id of crew.slice(0, 3)) s = reduce(voteOut(clueRound(s), id), { type: 'CONTINUE' });
  assert.equal(s.result.winner, 'imposters');
  assert.equal(s.scores[sidekick], WIN_POINTS[s.result.reason], 'they won it too');
});

test('a win is paid by the road it took', () => {
  // Every way of winning, and what it is worth. If a number in the table
  // changes, this is the test that says so out loud.
  const paths = {
    cleanSweep: () => {
      // nobody from the crew is lost: vote the imposter out first time
      let g = revealAll(started(FIVE, { imposterCount: 1, allowSteal: false, scoring: true }, 2));
      return reduce(voteOut(clueRound(g), g.imposterIds[0]), { type: 'CONTINUE' });
    },
    caught: () => {
      let g = revealAll(started(FIVE, { imposterCount: 1, allowSteal: false, scoring: true, maxRounds: ROUNDS_UNLIMITED }, 21));
      const crew = g.players.map((p) => p.id).filter((id) => id !== g.imposterIds[0]);
      g = reduce(voteOut(clueRound(g), crew[0]), { type: 'CONTINUE' });
      return reduce(voteOut(clueRound(g), g.imposterIds[0]), { type: 'CONTINUE' });
    },
    called: () => {
      const g = revealAll(started(FIVE, { imposterCount: 1, allowCall: true, scoring: true }, 5));
      return reduce(g, { type: 'CALL_WORD', playerId: g.imposterIds[0], text: g.secretWord });
    },
    steal: () => {
      let g = revealAll(started(FIVE, { imposterCount: 1, allowSteal: true, scoring: true }, 31));
      g = reduce(voteOut(clueRound(g), g.imposterIds[0]), { type: 'CONTINUE' });
      return reduce(g, { type: 'STEAL_GUESS', text: g.secretWord });
    },
    jester: () => {
      const g = revealAll(started(SEVEN, { roles: [ROLE.JESTER], scoring: true }, 6));
      return reduce(voteOut(clueRound(g), one(g, ROLE.JESTER)), { type: 'CONTINUE' });
    },
  };

  for (const [reason, play] of Object.entries(paths)) {
    const s = play();
    assert.equal(s.phase, PHASE.GAME_OVER, `${reason}: the game should be over`);
    assert.equal(s.result.reason, reason, `${reason}: took a different road`);
    assert.equal(s.lastAward, WIN_POINTS[reason], `${reason}: paid the wrong amount`);
    for (const id of s.lastWinners) {
      assert.equal(s.scores[id], WIN_POINTS[reason], `${reason}: ${id} was paid wrong`);
    }
  }

  // and the bold roads really do pay more than the quiet ones
  assert.ok(WIN_POINTS.called > WIN_POINTS.time, 'calling it should beat running the clock out');
  assert.ok(WIN_POINTS.cleanSweep > WIN_POINTS.caught, 'a clean sweep should beat a costly one');
});

test('losing a sidekick does not cost the crew their clean sweep', () => {
  // The sidekick was never theirs to lose.
  let s = revealAll(started(SEVEN, { imposterCount: 1, roles: [ROLE.SIDEKICK], allowSteal: false, scoring: true, maxRounds: ROUNDS_UNLIMITED }, 7));
  s = reduce(voteOut(clueRound(s), one(s, ROLE.SIDEKICK)), { type: 'CONTINUE' });
  s = reduce(voteOut(clueRound(s), s.imposterIds[0]), { type: 'CONTINUE' });
  assert.equal(s.result.winner, 'crew');
  assert.equal(s.result.reason, 'cleanSweep');
});

test('the score is the night, not the game', () => {
  let s = revealAll(started(FIVE, { imposterCount: 1, allowSteal: false, scoring: true }, 2));
  s = reduce(voteOut(clueRound(s), s.imposterIds[0]), { type: 'CONTINUE' });
  const afterOne = { ...s.scores };
  assert.ok(Object.values(afterOne).some((n) => n > 0));

  s = reduce(s, { type: 'PLAY_AGAIN' });
  assert.deepEqual(s.scores, afterOne, 'playing again kept the score');
  s = reduce(s, { type: 'RESET' });
  assert.deepEqual(s.scores, afterOne, 'ending the game kept the score');

  s = reduce(s, { type: 'CLEAR_SCORES' });
  assert.deepEqual(s.scores, {}, 'and it can be wiped by hand');
});


/* packs the table wrote ------------------------------------------- */

const OURS = {
  id: 'custom:ours',
  name: 'Our flat',
  emoji: '🏠',
  lang: 'en',
  hint: 'Our flat',
  custom: true,
  pairs: [
    { word: 'Sofa', decoy: 'Armchair' },
    { word: 'Kettle', decoy: null },
    { word: 'Balcony', decoy: null },
    { word: 'Landlord', decoy: null },
    { word: 'Boiler', decoy: null },
    { word: 'Doormat', decoy: null },
  ],
};

const withPacks = (names, config = {}, packs = [OURS]) =>
  reduce(withPlayers(names, config), { type: 'SET_CUSTOM_PACKS', packs });

test('a game can be dealt from a pack the table wrote', () => {
  const s = reduce(withPacks(FIVE, { packIds: ['custom:ours'] }), { type: 'START_GAME', seed: 3 });
  const words = OURS.pairs.map((p) => p.word);
  assert.ok(words.includes(s.secretWord), `dealt ${s.secretWord}, which is not in the pack`);
  assert.equal(s.packId, 'custom:ours');
});

test('an entry with no near miss borrows one from its own pack', () => {
  // Every word here except Sofa was written without one. The imposter still
  // has to be given something on near-miss mode, and it has to come from the
  // same pack or it is a different game.
  const words = OURS.pairs.map((p) => p.word);
  let sawBorrowed = false;
  for (let seed = 0; seed < 40; seed++) {
    const s = reduce(withPacks(FIVE, { packIds: ['custom:ours'], decoyMode: DECOY.RELATED }),
      { type: 'START_GAME', seed });
    assert.ok(s.imposterWord, `${seed}: the imposter was left with nothing`);
    assert.notEqual(s.imposterWord, s.secretWord, `${seed}: the imposter got the answer`);
    const pair = OURS.pairs.find((p) => p.word === s.secretWord);
    if (!pair.decoy) {
      sawBorrowed = true;
      assert.ok(words.includes(s.imposterWord), `${seed}: borrowed from outside the pack`);
    } else {
      assert.equal(s.imposterWord, pair.decoy, `${seed}: ignored a near miss that was written`);
    }
  }
  assert.ok(sawBorrowed, 'the borrowing branch never ran');
});

test('hint mode describes a custom word by the pack it came from', () => {
  const s = reduce(withPacks(FIVE, { packIds: ['custom:ours'], decoyMode: DECOY.HINT }),
    { type: 'START_GAME', seed: 8 });
  assert.equal(s.imposterHint.text, OURS.name, 'the pack name is the only category it has');
  assert.ok(s.imposterHint.chars > 0);
});

test('custom packs join the built-in ones rather than replacing them', () => {
  const s = reduce(withPacks(FIVE, { packIds: [] }), { type: 'START_GAME', seed: 12 });
  assert.ok(pairCount('en', [], [OURS]) > pairCount('en', []), 'the pool should have grown');
  assert.ok(s.secretWord);
});

test('the words in a custom pack never reach the other phones', () => {
  const s = reduce(withPacks(FIVE, { packIds: ['custom:ours'] }), { type: 'START_GAME', seed: 5 });
  const pub = publicState(s);

  // The label survives — every phone needs to name the pack on a card.
  assert.equal(pub.customPacks.length, 1);
  assert.equal(pub.customPacks[0].name, 'Our flat');
  assert.equal(pub.customPacks[0].count, OURS.pairs.length);

  // The list does not. A word list is a list of candidate answers.
  assert.deepEqual(pub.customPacks[0].pairs, []);
  const wire = JSON.stringify(pub);
  for (const { word } of OURS.pairs) {
    if (word === s.secretWord) continue; // checked by the secret-word tests
    assert.ok(!wire.includes(word), `"${word}" was broadcast`);
  }
});

test('a pack that arrives over the network is cleaned before it is used', () => {
  const s = reduce(withPlayers(FIVE), {
    type: 'SET_CUSTOM_PACKS',
    packs: [
      OURS,
      null,
      'not a pack',
      { name: 'Too small', pairs: [{ word: 'One' }] },
      { name: 'Fine', pairs: OURS.pairs },
    ],
  });
  assert.equal(s.customPacks.length, 2, 'the junk should be dropped, the rest kept');
  for (const pack of s.customPacks) {
    assert.ok(pack.name && Array.isArray(pack.pairs) && pack.pairs.length >= 5);
  }
});

test('packs stay with the table across games', () => {
  let s = reduce(withPacks(FIVE, { packIds: ['custom:ours'] }), { type: 'START_GAME', seed: 2 });
  s = reduce(s, { type: 'PLAY_AGAIN' });
  assert.equal(s.customPacks.length, 1, 'playing again lost the pack');
  s = reduce(s, { type: 'RESET' });
  assert.equal(s.customPacks.length, 1, 'ending the game lost the pack');
});

test('choosing only a pack that has been deleted still deals a game', () => {
  // The alternative is a lobby that refuses to start and does not say why.
  const s = reduce(withPlayers(FIVE, { packIds: ['custom:gone'] }), { type: 'START_GAME', seed: 4 });
  assert.equal(s.phase, PHASE.REVEAL);
  assert.ok(s.secretWord);
});

/* fuzz ------------------------------------------------------------- */

test('a thousand random games always terminate with a winner', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const count = 3 + (seed % 6);
    const names = FIVE.concat(['Fay', 'Gus', 'Hal']).slice(0, count);
    let s = revealAll(
      started(names, { imposterCount: 1 + (seed % 2), maxRounds: 4 }, seed),
    );
    let guard = 0;
    while (s.phase !== PHASE.GAME_OVER) {
      if (guard++ > 200) assert.fail(`game ${seed} did not finish`);
      if (s.phase === PHASE.CLUES) {
        s = reduce(s, { type: 'SUBMIT_CLUE', playerId: currentTurn(s), text: `w${seed}x${guard}` });
      } else if (s.phase === PHASE.VOTE) {
        const alive = alivePlayers(s).map((p) => p.id);
        const voter = pendingVoters(s)[0];
        const target = alive.filter((id) => id !== voter)[(seed + guard) % (alive.length - 1)];
        s = reduce(s, { type: 'CAST_VOTE', voterId: voter, targetId: target });
      } else if (s.phase === PHASE.VERDICT) {
        s = reduce(s, { type: 'CONTINUE' });
      } else if (s.phase === PHASE.STEAL) {
        s = reduce(s, { type: 'STEAL_GUESS', text: seed % 3 ? 'nope' : s.secretWord });
      }
    }
    assert.ok(['crew', 'imposters'].includes(s.result.winner));
  }
});

/**
 * The same, but across every setting rather than the defaults, and checking
 * what must never happen rather than only that it finishes.
 *
 * The first fuzz test plays the standard game a thousand times. This one
 * turns every knob — blind, hint, way off, calling, final guesses, unlimited
 * rounds, a hidden imposter count, one pack or ten, three languages — and
 * takes whichever legal action a coin lands on, including the ones a normal
 * game never reaches.
 */
test('two thousand games under every combination of settings stay lawful', () => {
  const NAMES = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];
  const LANGS = ['en', 'th', 'de'];
  const DECOYS = [DECOY.BLANK, DECOY.RELATED, DECOY.UNRELATED, DECOY.HINT];
  const PACKSETS = [[], ['jobs'], ['food', 'animals']];
  let called = 0;
  let jesters = 0;
  let stolen = 0;
  let declared = 0;
  let forced = 0;

  for (let seed = 0; seed < 2000; seed++) {
    // A tiny generator of its own, so a failing seed can be replayed exactly.
    let n = seed * 2654435761 + 1;
    const rand = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
    const pick = (list) => list[Math.floor(rand() * list.length)];

    const players = NAMES.slice(0, 3 + Math.floor(rand() * 6));
    const config = {
      wordLang: pick(LANGS),
      packIds: pick(PACKSETS),
      decoyMode: pick(DECOYS),
      imposterKnows: rand() < 0.3 ? false : true,
      allowCall: rand() < 0.5,
      allowSteal: rand() < 0.5,
      maxRounds: pick([2, 3, 4, 5, ROUNDS_UNLIMITED]),
      imposterCount: pick([IMPOSTERS_AUTO, IMPOSTERS_RANDOM, 1, 2]),
      roles: SPECIAL_ROLES.filter(() => rand() < 0.45),
      scoring: rand() < 0.5,
    };

    let s = revealAll(started(players, config, seed));
    const secret = s.secretWord;
    const ids = s.players.map((p) => p.id);
    const startingScores = { ...s.scores };

    /** Everything that must be true of any state, at any moment. */
    const check = (where) => {
      assert.ok(Object.values(PHASE).includes(s.phase), `${seed} ${where}: bad phase`);
      assert.equal(
        new Set(s.eliminated).size,
        s.eliminated.length,
        `${seed} ${where}: somebody was eliminated twice`,
      );
      for (const id of s.eliminated) assert.ok(ids.includes(id), `${seed} ${where}: unknown id out`);

      for (const id of ids) {
        const view = viewFor(s, id);
        const isImp = s.imposterIds.includes(id);
        if (isImp) {
          // The one rule the whole game rests on.
          assert.notEqual(view.word, secret, `${seed} ${where}: an imposter was shown the word`);
        } else {
          assert.equal(view.word, secret, `${seed} ${where}: a crew card lost the word`);
        }
        assert.equal(view.packId, s.packId, `${seed} ${where}: a card named the wrong pack`);
      }

      const pub = JSON.stringify(publicState(s));
      if (s.phase !== PHASE.GAME_OVER) {
        assert.ok(!pub.includes(secret), `${seed} ${where}: the word reached the broadcast`);
        assert.equal(publicState(s).imposterIds.length, 0, `${seed} ${where}: roles leaked`);
        assert.ok(!('history' in publicState(s)), `${seed} ${where}: history leaked`);
        // Only while the game is actually being played: during a verdict the
        // last imposter may already be out, and that verdict is precisely the
        // screen announcing it.
        if (s.phase === PHASE.CLUES || s.phase === PHASE.VOTE) {
          assert.ok(
            alivePlayers(s).some((p) => s.imposterIds.includes(p.id)),
            `${seed} ${where}: play continues with no imposter left`,
          );
        }
      }
      if (s.config.maxRounds !== ROUNDS_UNLIMITED) {
        assert.ok(s.round <= s.config.maxRounds, `${seed} ${where}: round ${s.round} past the limit`);
      }

      // Roles: dealt to distinct people, never to an imposter, never so many
      // that the table runs out of ordinary crew.
      const dealt = Object.keys(s.roles);
      assert.equal(new Set(dealt).size, dealt.length, `${seed} ${where}: a role dealt twice`);
      for (const id of dealt) {
        assert.ok(!s.imposterIds.includes(id), `${seed} ${where}: an imposter has a second role`);
        assert.ok(SPECIAL_ROLES.includes(s.roles[id]), `${seed} ${where}: unknown role`);
        assert.ok(s.config.roles.includes(s.roles[id]), `${seed} ${where}: a role nobody asked for`);
      }
      assert.ok(
        ids.filter((id) => roleOf(s, id) === ROLE.CREW).length >= PLAIN_CREW_FLOOR,
        `${seed} ${where}: not enough plain crew left`,
      );
      if (s.phase !== PHASE.GAME_OVER) {
        assert.deepEqual(publicState(s).roles, {}, `${seed} ${where}: the roles leaked`);
      }

      // A score only ever goes up, and only when a game ends.
      for (const id of ids) {
        const before = startingScores[id] || 0;
        const now = s.scores[id] || 0;
        assert.ok(now >= before, `${seed} ${where}: a score went down`);
        assert.ok(
          now - before <= MAX_WIN_POINTS,
          `${seed} ${where}: more than one game's worth of points`,
        );
        if (!s.config.scoring) assert.equal(now, 0, `${seed} ${where}: scored with scoring off`);
      }
    };

    check('start');

    let guard = 0;
    while (s.phase !== PHASE.GAME_OVER) {
      if (guard++ > 400) assert.fail(`game ${seed} never finished`);
      const before = s;

      if (s.phase === PHASE.CLUES) {
        const turn = currentTurn(s);
        // An imposter who is allowed to call sometimes does, right or wrong.
        if (s.config.allowCall && s.imposterIds.includes(turn) && rand() < 0.15) {
          const right = rand() < 0.5;
          s = reduce(s, { type: 'CALL_WORD', playerId: turn, text: right ? secret : 'not the word' });
          called++;
        } else if (rand() < 0.04) {
          s = reduce(s, { type: 'FORCE_VOTE' });
          forced++;
        } else {
          s = reduce(s, { type: 'SUBMIT_CLUE', playerId: turn, text: `w${seed}-${guard}` });
        }
      } else if (s.phase === PHASE.VOTE) {
        if (rand() < 0.15) {
          // the show-of-hands shortcut, including a declared tie
          const alive = alivePlayers(s).map((p) => p.id);
          s = reduce(s, {
            type: 'DECLARE_ELIMINATION',
            playerId: rand() < 0.15 ? null : alive[Math.floor(rand() * alive.length)],
          });
          declared++;
        } else {
          const voter = pendingVoters(s)[0];
          const others = alivePlayers(s).map((p) => p.id).filter((id) => id !== voter);
          s = reduce(s, {
            type: 'CAST_VOTE',
            voterId: voter,
            targetId: others[Math.floor(rand() * others.length)],
          });
        }
      } else if (s.phase === PHASE.VERDICT) {
        s = reduce(s, { type: 'CONTINUE' });
      } else if (s.phase === PHASE.STEAL) {
        s = reduce(s, { type: 'STEAL_GUESS', text: rand() < 0.4 ? secret : 'nope' });
        stolen++;
      } else if (s.phase === PHASE.REVEAL) {
        s = revealAll(s);
      } else {
        assert.fail(`${seed}: stuck in ${s.phase}`);
      }

      assert.notEqual(s, before, `${seed}: an action changed nothing`);
      check(s.phase);
    }

    if (s.result.winner === 'jester') jesters++;
    assert.ok(['crew', 'imposters', 'jester'].includes(s.result.winner), `${seed}: no winner`);
    if (s.config.scoring) {
      assert.equal(s.lastAward, WIN_POINTS[s.result.reason], `${seed}: unknown road ${s.result.reason}`);
    }
    if (s.result.winner === 'jester') {
      const jester = ids.find((id) => roleOf(s, id) === ROLE.JESTER);
      assert.ok(jester, `${seed}: a jester won without being dealt`);
      assert.ok(!isAlive(s, jester), `${seed}: the jester won without being voted out`);
    }
    if (s.config.scoring) {
      const paid = ids.filter((id) => (s.scores[id] || 0) > (startingScores[id] || 0));
      assert.ok(paid.length > 0, `${seed}: somebody won and nobody was paid`);
      for (const id of paid) {
        if (s.result.winner === 'jester') {
          assert.equal(roleOf(s, id), ROLE.JESTER, `${seed}: the wrong side was paid`);
        } else if (s.result.winner === 'imposters') {
          assert.ok(isImposterSide(s, id), `${seed}: crew paid for an imposter win`);
        } else {
          assert.ok(!isImposterSide(s, id) && roleOf(s, id) !== ROLE.JESTER,
            `${seed}: the wrong side was paid for a crew win`);
          assert.ok(isAlive(s, id), `${seed}: a crew member scored after being voted out`);
        }
      }
    }
    // Everything is on the table once it is over.
    assert.equal(publicState(s).secretWord, secret);
  }

  // If a branch never ran, the test is quietly weaker than it looks.
  assert.ok(called > 50, `only ${called} calls exercised`);
  assert.ok(stolen > 50, `only ${stolen} final guesses exercised`);
  assert.ok(declared > 50, `only ${declared} declared eliminations exercised`);
  assert.ok(forced > 50, `only ${forced} forced votes exercised`);
  assert.ok(jesters > 10, `only ${jesters} jester wins exercised`);
});

/** A refused action must leave the game exactly as it was. */
test('an illegal action is refused without touching the game', () => {
  let s = revealAll(started(FIVE, { allowCall: true, allowSteal: true }, 5));
  const snapshot = JSON.parse(JSON.stringify(s));
  const crew = s.players.find((p) => !s.imposterIds.includes(p.id)).id;
  const notTurn = s.order.find((id) => id !== currentTurn(s));

  const illegal = [
    { type: 'ADD_PLAYER', name: 'Late' },              // game already started
    { type: 'SET_CONFIG', config: { maxRounds: 2 } },  // not in the lobby
    { type: 'SUBMIT_CLUE', playerId: notTurn, text: 'early' },
    { type: 'CAST_VOTE', voterId: crew, targetId: crew },
    { type: 'STEAL_GUESS', text: 'now' },              // not the steal phase
    { type: 'CALL_WORD', playerId: crew, text: 'x' },  // crew cannot call
    { type: 'CONTINUE' },                              // nothing to continue
    { type: 'NONSENSE' },
  ];

  for (const action of illegal) {
    assert.throws(() => reduce(s, action), GameError, `${action.type} should have been refused`);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), snapshot, `${action.type} left a mark`);
  }
});

/** The server replays actions; the same ones must always land in the same place. */
test('the same seed and the same actions give the same game', () => {
  const play = () => {
    let s = revealAll(started(FIVE, { imposterCount: 2, decoyMode: DECOY.UNRELATED }, 99));
    s = clueRound(s);
    s = voteOut(s, s.players[2].id);
    return reduce(s, { type: 'CONTINUE' });
  };
  clueSeq = 0;
  const a = play();
  clueSeq = 0;
  const b = play();
  assert.deepEqual(a, b);
});


/* ------------------------------------------------------------------ *
 * The imposters' side, not just the imposters
 * ------------------------------------------------------------------ */

test('an ally costs a seat, so the cap leaves room for the sidekick', () => {
  // Without the roles argument this is the old question, still the right one
  // for a table that has no special roles on.
  assert.equal(maxImpostersFor(6), 2);
  assert.equal(maxImpostersFor(6, []), 2);
  assert.equal(maxImpostersFor(6, ['detective', 'jester']), 2, 'crew-side roles cost nothing');
  assert.equal(maxImpostersFor(6, ['sidekick']), 1);
  assert.equal(maxImpostersFor(12, ['sidekick']), 4);
  // It never offers none: a game with no imposter is not this game.
  assert.equal(maxImpostersFor(4, ['sidekick']), 1);
});

test('no table size ever deals a game the crew has already lost', () => {
  // This is the whole bug in one loop. `resolveOutcome` ends the game the
  // moment the imposters' side is level with the crew, and the sidekick is
  // on that side — so a lobby that was legal by every check dealt a game
  // that was over before anybody spoke: one clue round, one vote, and every
  // possible result read `imposters/outnumbered`, a tie included. It held at
  // every table size from four up, and 16 of the 400 games in the behaviour
  // fingerprint were ending that way.
  for (let count = 4; count <= 12; count += 1) {
    const names = Array.from({ length: count }, (_, i) => `q${i + 1}`);
    for (const roles of [['sidekick'], ['detective', 'sidekick', 'jester']]) {
      const cap = maxImpostersFor(count, roles);
      for (const imposterCount of [1, cap]) {
        for (let seed = 0; seed < 40; seed += 1) {
          const s = started(names, { imposterCount, roles }, seed);
          const side = s.players.filter((p) => isImposterSide(s, p.id)).length;
          const crew = s.players.length - side;
          assert.ok(
            side < crew,
            `${count} players, ${imposterCount} imposters, ${roles.join('+')}, seed ${seed}: ` +
              `dealt ${side} on the imposters' side against ${crew} crew`,
          );
        }
      }
    }
  }
});

test('a sidekick is simply not dealt when there is no room for one', () => {
  // Four players and one imposter: handing out the sidekick would make it
  // two against two. The role is a bonus, not a promise.
  for (let seed = 0; seed < 25; seed += 1) {
    const s = started(['a', 'b', 'c', 'd'], { imposterCount: 1, roles: ['sidekick'] }, seed);
    assert.ok(
      !Object.values(s.roles).includes(ROLE.SIDEKICK),
      `seed ${seed} dealt a sidekick into a four-player game`,
    );
  }
  // Six is roomy enough for one.
  const roomy = Array.from({ length: 25 }, (_, seed) =>
    started(['a', 'b', 'c', 'd', 'e', 'f'], { imposterCount: 1, roles: ['sidekick'] }, seed),
  );
  assert.ok(
    roomy.some((s) => Object.values(s.roles).includes(ROLE.SIDEKICK)),
    'six players should still see a sidekick',
  );
});


/* ------------------------------------------------------------------ *
 * Words with no letters in them
 *
 * `normalise` keeps letters, digits and marks and throws the rest away, so
 * anything made of punctuation or emoji comes back as the empty string. Three
 * separate rules compared normalised forms with `===`, which made every one
 * of those strings equal to every other one — and equal to nothing at all.
 * ------------------------------------------------------------------ */

test('nothing is not a word, and never matches', () => {
  assert.equal(normalise('???'), '');
  assert.equal(normalise('🎉'), '');
  // The old comparison. Two things that are not words were "the same word".
  assert.equal(normalise('???') === normalise('🎉'), true);
  // The question the game actually needs to ask.
  assert.equal(sameWord('???', '🎉'), false);
  assert.equal(sameWord('', ',,,'), false);
  assert.equal(sameWord('', ''), false);
  // And it still answers the ordinary question the same way.
  assert.equal(sameWord('Café', 'cafe'), true);
  assert.equal(sameWord('Straße', 'strasse'), true);
  assert.equal(sameWord('cat', 'dog'), false);
});

test('a final guess cannot be won by typing nothing', () => {
  const g = started(FIVE, { imposterCount: 1, allowSteal: true }, 8);
  let s = voteOut(clueRound(revealAll(g)), g.imposterIds[0]);
  s = reduce(s, { type: 'CONTINUE' });
  assert.equal(s.phase, PHASE.STEAL, 'the voted-out imposter gets a final guess');
  const imposter = g.imposterIds[0];

  // The screen disables the button on an empty box, but the room endpoint is
  // open and the reducer is the only thing that decides.
  assert.throws(
    () => reduce(s, { type: 'STEAL_GUESS', playerId: imposter, text: '' }),
    (e) => e instanceof GameError && e.code === 'emptyGuess',
  );
  assert.throws(
    () => reduce(s, { type: 'STEAL_GUESS', playerId: imposter, text: '   ' }),
    (e) => e instanceof GameError && e.code === 'emptyGuess',
  );
});

test('two different emoji are two different clues', () => {
  let s = revealAll(started(['a', 'b', 'c']));
  const first = currentTurn(s);
  s = reduce(s, { type: 'SUBMIT_CLUE', playerId: first, text: '🎉' });
  const second = currentTurn(s);
  // This used to be refused as `clueTaken`: both normalise to nothing, and
  // the game told the second player someone had already said theirs.
  s = reduce(s, { type: 'SUBMIT_CLUE', playerId: second, text: '🔥' });
  assert.deepEqual(
    s.clues.map((c) => c.text),
    ['🎉', '🔥'],
  );

  // The same one twice is still the same clue.
  const third = currentTurn(s);
  assert.throws(
    () => reduce(s, { type: 'SUBMIT_CLUE', playerId: third, text: '🎉' }),
    (e) => e instanceof GameError && e.code === 'clueTaken',
  );
});
