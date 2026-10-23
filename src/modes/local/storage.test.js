/**
 * What one phone remembers, and — the part this was written for — what it
 * hands back when somebody reloads in the middle of a round.
 *
 * Until this file existed, `modes/` had 1,490 lines and no tests at all, and
 * the bug it was hiding was not subtle: the roster, the scores and the
 * settings all survived a reload and the game itself did not. A phone that
 * slept too long during the clue phase came back to the home screen.
 *
 * There is no localStorage in Node, so these put a small fake in its place —
 * including one that throws on every call, which is what a private window
 * does, and which the game is supposed to shrug off rather than die on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, reduce, PHASE } from '../../core/engine.js';
import { VERSION } from '../../content/history/changelog.js';
import '../../testing/ready.js';
import {
  GAME_KEY,
  ROSTER_KEY,
  clearGame,
  isResumable,
  loadGame,
  loadRecentWords,
  loadRoster,
  loadScores,
  saveGame,
  saveRecentWords,
  saveRoster,
  saveScores,
} from './storage.js';

/* ------------------------------------------------------------------ *
 * A phone's storage, and a phone that refuses to have any
 * ------------------------------------------------------------------ */

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() {
      return map.size;
    },
    raw: map,
  };
}

/** A private window: every call throws. Nothing here may crash because of it. */
const lockedStorage = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
  removeItem() {
    throw new Error('denied');
  },
};

const withStorage = (storage, body) => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage;
  try {
    return body();
  } finally {
    if (had) globalThis.localStorage = previous;
    else delete globalThis.localStorage;
  }
};

/** A real game, mid-round, exactly as the screens would have it. */
function aRoundInProgress(seed = 7) {
  let state = createGame({ wordLang: 'en', scoring: true });
  for (const name of ['Ann', 'Ben', 'Cal', 'Dee']) {
    state = reduce(state, { type: 'ADD_PLAYER', name });
  }
  state = reduce(state, { type: 'START_GAME', seed });
  for (const id of state.order) state = reduce(state, { type: 'MARK_REVEALED', playerId: id });
  return state;
}

/* ------------------------------------------------------------------ *
 * The round itself
 * ------------------------------------------------------------------ */

test('a round saved mid-game comes back the same round', () => {
  const store = fakeStorage();
  const game = aRoundInProgress();

  withStorage(store, () => {
    saveGame(game);
    const back = loadGame();
    assert.ok(back, 'the game should come back');
    assert.equal(back.phase, game.phase);
    assert.equal(back.secretWord, game.secretWord);
    assert.deepEqual(back.players, game.players);
    assert.deepEqual(back.imposterIds, game.imposterIds);
    assert.deepEqual(back.roles, game.roles);
    assert.equal(back.round, game.round);
  });
});

test('the packs are not written into the round', () => {
  // They are saved separately and can be thousands of words; a round is a
  // few hundred bytes without them.
  const store = fakeStorage();
  const game = { ...aRoundInProgress(), customPacks: [{ id: 'x', pairs: new Array(400).fill(0) }] };

  withStorage(store, () => {
    saveGame(game);
    const written = JSON.parse(store.getItem(GAME_KEY));
    assert.equal(written.customPacks, undefined, 'the packs should not be in here');
    assert.ok(store.getItem(GAME_KEY).length < 4000, 'a saved round should be small');
  });
});

test('a finished game is not offered back', () => {
  const store = fakeStorage();
  withStorage(store, () => {
    saveGame({ ...aRoundInProgress(), phase: PHASE.GAME_OVER });
    assert.equal(loadGame(), null, 'next week starts clean');
  });
});

test('a game still in the lobby is not offered back', () => {
  // There is nothing to resume, and the roster and settings come back on
  // their own anyway.
  const store = fakeStorage();
  withStorage(store, () => {
    saveGame({ ...aRoundInProgress(), phase: PHASE.LOBBY });
    assert.equal(loadGame(), null);
  });
});

test('clearing it leaves nothing behind', () => {
  const store = fakeStorage();
  withStorage(store, () => {
    saveGame(aRoundInProgress());
    clearGame();
    assert.equal(loadGame(), null);
    assert.equal(store.getItem(GAME_KEY), null);
  });
});

test('a round dealt by a different version is dropped, not resumed', () => {
  // The rules may have moved underneath it. Losing a round is a bad evening;
  // restoring a state this build does not understand could deal somebody two
  // roles, and that is a worse one.
  const store = fakeStorage();
  withStorage(store, () => {
    saveGame(aRoundInProgress());
    const saved = JSON.parse(store.getItem(GAME_KEY));
    assert.equal(saved.version, VERSION, 'the version should be stamped on it');
    store.setItem(GAME_KEY, JSON.stringify({ ...saved, version: '0.0.1' }));
    assert.equal(loadGame(), null);
  });
});

test('something that does not validate is cleared rather than re-read for ever', () => {
  const store = fakeStorage({ [GAME_KEY]: '{"phase":"vote","players":[],"version":"0.0.1"}' });
  withStorage(store, () => {
    assert.equal(loadGame(), null);
    assert.equal(store.getItem(GAME_KEY), null, 'it should not still be sitting there');
  });
});

test('nonsense in storage is survived', () => {
  for (const junk of ['', 'not json', 'null', '[]', '42', '{"phase":"vote"}']) {
    const store = fakeStorage({ [GAME_KEY]: junk });
    withStorage(store, () => {
      assert.equal(loadGame(), null, `${junk} should not come back as a game`);
    });
  }
});

/* ------------------------------------------------------------------ *
 * What counts as resumable
 * ------------------------------------------------------------------ */

test('a state that mentions somebody who is not at the table is refused', () => {
  const game = aRoundInProgress();
  const stamped = (extra) => ({ ...game, version: VERSION, ...extra });

  assert.equal(isResumable(stamped()), true, 'the real thing should pass');
  assert.equal(isResumable(stamped({ order: ['nobody'] })), false, 'an unknown in the order');
  assert.equal(isResumable(stamped({ imposterIds: ['nobody'] })), false, 'an unknown imposter');
  assert.equal(isResumable(stamped({ eliminated: ['nobody'] })), false, 'an unknown eliminated');
  assert.equal(isResumable(stamped({ roles: { nobody: 'jester' } })), false, 'an unknown role');
});

test('a table too small or too big to be a game is refused', () => {
  const game = aRoundInProgress();
  const stamped = (players) => ({ ...game, version: VERSION, players });
  assert.equal(isResumable(stamped([{ id: 'a', name: 'Ann' }])), false);
  assert.equal(isResumable(stamped(new Array(13).fill({ id: 'a', name: 'Ann' }))), false);
  assert.equal(isResumable(stamped([{ id: 'a' }, { id: 'b' }, { id: 'c' }])), false, 'no names');
});

test('a phase this build has never heard of is refused', () => {
  const game = { ...aRoundInProgress(), version: VERSION, phase: 'timewarp' };
  assert.equal(isResumable(game), false);
});

test('a round number that is not a round is refused', () => {
  const game = aRoundInProgress();
  for (const round of [-1, 1.5, '2', null, undefined]) {
    assert.equal(isResumable({ ...game, version: VERSION, round }), false, `round ${round}`);
  }
});

/* ------------------------------------------------------------------ *
 * The rest of what a phone remembers
 * ------------------------------------------------------------------ */

test('the roster comes back, and nonsense in it does not', () => {
  const store = fakeStorage();
  withStorage(store, () => {
    saveRoster([{ id: '1', name: 'Ann' }, { id: '2', name: 'Ben' }]);
    assert.deepEqual(loadRoster(), ['Ann', 'Ben']);

    store.setItem(ROSTER_KEY, JSON.stringify(['Ann', 42, null, 'Ben']));
    assert.deepEqual(loadRoster(), ['Ann', 'Ben'], 'only the names');

    store.setItem(ROSTER_KEY, JSON.stringify(new Array(40).fill('Ann')));
    assert.equal(loadRoster().length, 12, 'no more than a full table');
  });
});

test('points are kept by name, because ids are minted fresh every load', () => {
  const store = fakeStorage();
  withStorage(store, () => {
    saveScores([{ id: 'old1', name: 'Ann' }, { id: 'old2', name: 'Ben' }], { old1: 3, old2: 0 });
    // Same people, new ids — which is what a reload actually looks like.
    const scores = loadScores([{ id: 'new1', name: 'Ann' }, { id: 'new2', name: 'Ben' }]);
    assert.equal(scores.new1, 3, "Ann's points followed her name");
    assert.equal(scores.new2, undefined, 'nobody is given a zero they did not have');
  });
});

test('recent words come back, capped, and filtered', () => {
  const store = fakeStorage();
  withStorage(store, () => {
    saveRecentWords(['Pizza', 'Lasagne']);
    assert.deepEqual(loadRecentWords(), ['Pizza', 'Lasagne']);
    saveRecentWords(new Array(200).fill('Pizza'));
    assert.equal(loadRecentWords().length, 60);
  });
});

/* ------------------------------------------------------------------ *
 * A phone that will not remember anything
 * ------------------------------------------------------------------ */

test('a private window forgets instead of breaking', () => {
  withStorage(lockedStorage, () => {
    const game = aRoundInProgress();
    assert.doesNotThrow(() => saveGame(game));
    assert.doesNotThrow(() => clearGame());
    assert.doesNotThrow(() => saveRoster(game.players));
    assert.doesNotThrow(() => saveScores(game.players, {}));
    assert.doesNotThrow(() => saveRecentWords(['Pizza']));
    assert.equal(loadGame(), null);
    assert.deepEqual(loadRoster(), []);
    assert.deepEqual(loadScores(game.players), {});
    assert.deepEqual(loadRecentWords(), []);
  });
});

test('a browser with no storage at all is survived', () => {
  // Not hypothetical: this is every one of these functions running under
  // `node --test`, where there is no localStorage to be had.
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const previous = globalThis.localStorage;
  if (had) delete globalThis.localStorage;
  try {
    assert.equal(loadGame(), null);
    assert.doesNotThrow(() => saveGame(aRoundInProgress()));
    assert.deepEqual(loadRoster(), []);
  } finally {
    if (had) globalThis.localStorage = previous;
  }
});

// These arrays are required by the reveal, clue, and voting screens.
test('incomplete saved rounds are rejected and removed before the UI resumes them', () => {
  const game = aRoundInProgress();
  for (const key of ['order', 'imposterIds', 'eliminated', 'revealed']) {
    const saved = { ...game, version: VERSION };
    delete saved[key];
    const store = fakeStorage({ [GAME_KEY]: JSON.stringify(saved) });
    withStorage(store, () => {
      assert.equal(loadGame(), null, `missing ${key} cannot be resumed`);
      assert.equal(store.getItem(GAME_KEY), null, 'invalid round is removed');
    });
  }
});
