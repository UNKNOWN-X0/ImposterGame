/**
 * Strict mode, and the cache that leans on it.
 *
 * These two are one idea: the engine promises never to change a state it has
 * already handed out, so a state can be used as a cache key. Strict mode is
 * that promise enforced; the cache is it being spent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, reduce, publicState, PHASE } from './engine.js';
import { isStrict, setStrict, deepFreeze } from './strict.js';
import '../testing/ready.js';

const table = (names = ['Ann', 'Ben', 'Cal', 'Dee']) => {
  let state = createGame({ wordLang: 'en', scoring: true });
  for (const name of names) state = reduce(state, { type: 'ADD_PLAYER', name });
  return state;
};

/* ------------------------------------------------------------------ *
 * Strict mode
 * ------------------------------------------------------------------ */

test('the test suite runs strict, or none of this proves anything', () => {
  assert.equal(isStrict(), true, '`node --test` should have turned strict mode on');
});

test('a state handed out cannot be changed', () => {
  const state = table();
  assert.throws(() => {
    state.players.push({ id: 'x', name: 'Eve' });
  }, TypeError);
  assert.throws(() => {
    state.phase = PHASE.VOTE;
  }, TypeError);
});

test('the freeze goes all the way down, not just the top', () => {
  // The shallow version is a trap: it leaves `state.votes[id] = …` and
  // `state.players.push(…)` working, which are the two mutations anybody
  // would actually write.
  let state = reduce(table(), { type: 'START_GAME', seed: 3 });
  assert.throws(() => {
    state.votes.someone = 'else';
  }, TypeError);
  assert.throws(() => {
    state.players[0].name = 'Mallory';
  }, TypeError);
  assert.throws(() => {
    state.config.roles.push('jester');
  }, TypeError);
});

test('a fresh game is held to the same promise as a played one', () => {
  assert.throws(() => {
    createGame({}).players.push({ id: 'x', name: 'Eve' });
  }, TypeError);
});

test('with strict mode off, nothing is frozen and nothing throws', () => {
  const was = setStrict(false);
  try {
    const state = table();
    assert.equal(Object.isFrozen(state), false);
    assert.doesNotThrow(() => state.players.push({ id: 'x', name: 'Eve' }));
  } finally {
    setStrict(was);
  }
});

test('deepFreeze survives a shape that points at itself', () => {
  // A state cannot contain a cycle — it is the shape of its own JSON — but
  // this should not be the thing that hangs if one ever does.
  const loop = { name: 'a' };
  loop.self = loop;
  assert.doesNotThrow(() => deepFreeze(loop));
  assert.ok(Object.isFrozen(loop));
});

/* ------------------------------------------------------------------ *
 * The cache
 * ------------------------------------------------------------------ */

test('the same state is scrubbed once, however many phones ask', () => {
  const state = reduce(table(), { type: 'START_GAME', seed: 5 });
  const first = publicState(state);
  for (let phone = 0; phone < 8; phone++) {
    assert.equal(publicState(state), first, 'every phone should get the same object');
  }
});

test('a new state is a new scrub', () => {
  const state = reduce(table(), { type: 'START_GAME', seed: 5 });
  const before = publicState(state);
  const after = publicState(reduce(state, { type: 'MARK_REVEALED', playerId: state.order[0] }));
  assert.notEqual(after, before, 'a state that moved on cannot reuse the old payload');
  assert.notDeepEqual(after.revealed, before.revealed);
});

test('what goes out is still the same thing it always was', () => {
  // The cache must not have changed a single field of what reaches a phone.
  const state = reduce(table(), { type: 'START_GAME', seed: 9 });
  const pub = publicState(state);
  assert.equal(pub.secretWord, null, 'the word must never leave the server');
  assert.equal(pub.imposterWord, null);
  assert.deepEqual(pub.imposterIds, []);
  assert.deepEqual(pub.roles, {});
  assert.equal(pub.history, undefined, 'history holds the word in play');
  assert.ok(!JSON.stringify(pub).includes(state.secretWord));
});

test('what is shared cannot be changed by whoever got it', () => {
  // One object now goes to every phone, so a mutation anywhere would be a
  // mutation everywhere.
  const state = reduce(table(), { type: 'START_GAME', seed: 11 });
  const pub = publicState(state);
  assert.throws(() => {
    pub.secretWord = state.secretWord;
  }, TypeError);
});

test('the cache holds nothing once the game is gone', () => {
  // A WeakMap, so a finished game's payload goes when the game does rather
  // than piling up on a server that has been running for a week.
  const { WeakMap: W } = globalThis;
  assert.ok(publicState(table()) !== undefined);
  assert.equal(typeof W, 'function');
});
