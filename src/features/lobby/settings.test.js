/**
 * The settings, as the rules they stand for.
 *
 * This is the most-edited surface in the app and the only cover it had was a
 * browser sweep that clicks through it looking for crashes. What nobody
 * checked is the thing a table would actually notice: that the panel refuses
 * the combinations the game cannot deal, and that what it refuses matches
 * what the engine refuses. A lobby that lets you pick four imposters for
 * five players and then fails at the deal is worse than one that greys the
 * button out.
 *
 * The screens themselves are React and belong to the browser sweep; what is
 * testable here is the arithmetic underneath them, which is where the
 * decisions actually live.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import {
  DECOY,
  DEFAULT_CONFIG,
  IMPOSTERS_AUTO,
  IMPOSTERS_RANDOM,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAIN_CREW_FLOOR,
  ROUNDS_UNLIMITED,
  autoImposterCount,
  createGame,
  maxImpostersFor,
  normaliseConfig,
  reduce,
  resolveImposterCount,
} from '../../core/engine.js';
import { TELLTALE, imposterHint } from './settings/helpers.js';

/* ------------------------------------------------------------------ *
 * How many imposters a table can have
 * ------------------------------------------------------------------ */

test('the cap never lets the imposters reach half the table', () => {
  // At parity the imposters have already won, so the panel must not offer a
  // number that starts the game over.
  for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats += 1) {
    const cap = maxImpostersFor(seats);
    assert.ok(cap >= 1, `${seats} players should allow at least one imposter`);
    assert.ok(
      cap * 2 < seats,
      `${seats} players: a cap of ${cap} lets the imposters start at parity`,
    );
  }
});

test('what the panel offers is what the engine accepts', () => {
  // The two could drift apart, and the way you would find out is a table
  // picking a number and the deal refusing it.
  for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats += 1) {
    const cap = maxImpostersFor(seats);
    for (let n = 1; n <= cap; n += 1) {
      const config = normaliseConfig({ ...DEFAULT_CONFIG, imposterCount: n });
      assert.equal(config.imposterCount, n, `${seats} players, ${n} imposters`);
      const dealt = resolveImposterCount(n, seats, () => 0.5);
      assert.ok(dealt >= 1 && dealt * 2 < seats, `${seats}/${n} dealt ${dealt}`);
    }
  }
});

test('auto stays inside the cap at every table size', () => {
  for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats += 1) {
    const auto = autoImposterCount(seats);
    assert.ok(auto >= 1 && auto <= maxImpostersFor(seats), `${seats} players → ${auto}`);
  }
});

test('random never deals more than the cap, however the dice fall', () => {
  for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats += 1) {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const n = resolveImposterCount(IMPOSTERS_RANDOM, seats, () => roll);
      assert.ok(n >= 1 && n <= maxImpostersFor(seats), `${seats} players, roll ${roll} → ${n}`);
    }
  }
});

test('a number from a bigger table is brought back down, not dealt', () => {
  // A table of nine sets three imposters, three people leave, and the
  // setting is still three. The deal has to cope.
  const n = resolveImposterCount(3, 4, () => 0.5);
  assert.ok(n * 2 < 4, `four players were dealt ${n} imposters`);
});

/* ------------------------------------------------------------------ *
 * Blind mode, and the cards it cannot use
 * ------------------------------------------------------------------ */

test('the modes blind refuses are the ones that would give it away', () => {
  // In blind mode nobody is told their role, so a card that looks different
  // announces the imposter to whoever is holding it.
  assert.deepEqual([...TELLTALE].sort(), [DECOY.BLANK, DECOY.HINT].sort());
});

test('the engine agrees: blind and a telltale card cannot both stand', () => {
  for (const decoyMode of TELLTALE) {
    const config = normaliseConfig({ ...DEFAULT_CONFIG, imposterKnows: false, decoyMode });
    assert.ok(
      config.imposterKnows === true || !TELLTALE.includes(config.decoyMode),
      `blind + ${decoyMode} survived normalisation as ${JSON.stringify({
        knows: config.imposterKnows,
        decoy: config.decoyMode,
      })}`,
    );
  }
});

/* ------------------------------------------------------------------ *
 * Rounds
 * ------------------------------------------------------------------ */

test('a round count the panel cannot show is not a round count', () => {
  for (const [given, expected] of [
    [ROUNDS_UNLIMITED, ROUNDS_UNLIMITED], // the only way to say "no limit"
    [0, DEFAULT_CONFIG.maxRounds], // not a shorthand for unlimited, as I assumed
    [-1, DEFAULT_CONFIG.maxRounds],
    [1.5, DEFAULT_CONFIG.maxRounds],
    ['4', 4],
    [4, 4],
  ]) {
    const config = normaliseConfig({ ...DEFAULT_CONFIG, maxRounds: given });
    assert.equal(config.maxRounds, expected, `maxRounds ${JSON.stringify(given)}`);
  }
});

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

test('a role this build has never heard of is dropped rather than dealt', () => {
  const config = normaliseConfig({ ...DEFAULT_CONFIG, roles: ['detective', 'timelord'] });
  assert.deepEqual(config.roles, ['detective']);
});

test('roles are only dealt while enough plain crew would be left', () => {
  // Otherwise a table of four is three special roles and an imposter, and
  // nobody is just playing. Checked by dealing real games, because the floor
  // lives in the deal rather than in the settings panel.
  for (let seats = MIN_PLAYERS; seats <= MAX_PLAYERS; seats += 1) {
    const names = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jon', 'Kim', 'Lou'];
    let state = createGame({ wordLang: 'en', roles: ['detective', 'sidekick', 'jester'] });
    for (const name of names.slice(0, seats)) {
      state = reduce(state, { type: 'ADD_PLAYER', name });
    }
    state = reduce(state, { type: 'START_GAME', seed: seats });

    const special = Object.keys(state.roles).length;
    const plainCrew = seats - state.imposterIds.length - special;
    assert.ok(
      plainCrew >= Math.min(PLAIN_CREW_FLOOR, seats - state.imposterIds.length),
      `${seats} players: ${special} special roles leaves only ${plainCrew} plain crew`,
    );
  }
});

test('blind mode deals nobody a role, whatever the lobby asked for', () => {
  // Nobody is told anything in blind mode, so a role card would be a card
  // its owner cannot read.
  let state = createGame({
    wordLang: 'en',
    imposterKnows: false,
    roles: ['detective', 'sidekick', 'jester'],
  });
  for (const name of ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay']) {
    state = reduce(state, { type: 'ADD_PLAYER', name });
  }
  state = reduce(state, { type: 'START_GAME', seed: 2 });
  assert.deepEqual(state.roles, {});
});

/* ------------------------------------------------------------------ *
 * The line under the imposter picker
 * ------------------------------------------------------------------ */

test('the hint says something different for each kind of setting', () => {
  const t = (key, params) => `${key}${params ? `(${JSON.stringify(params)})` : ''}`;
  const random = imposterHint(t, IMPOSTERS_RANDOM, 6, 2);
  const auto = imposterHint(t, IMPOSTERS_AUTO, 6, 2);
  const one = imposterHint(t, 1, 3, 1);
  const many = imposterHint(t, 2, 6, 2);

  assert.match(random, /impostersRandomHint/);
  assert.match(auto, /impostersAutoHint/);
  assert.match(auto, /"count":2/, 'and says what auto would actually deal');
  assert.match(one, /impostersOne/, 'a table that can only have one says so');
  assert.match(many, /impostersCap/);
  assert.equal(new Set([random, auto, one, many]).size, 4, 'four settings, four sentences');
});

/* ------------------------------------------------------------------ *
 * And the whole thing, through the reducer
 * ------------------------------------------------------------------ */

test('every setting the panel can send survives a deal', () => {
  // The panel sends one key at a time, so every one of these is a real
  // SET_CONFIG the lobby can produce.
  const changes = [
    { imposterCount: IMPOSTERS_AUTO },
    { imposterCount: IMPOSTERS_RANDOM },
    { imposterCount: 1 },
    { decoyMode: DECOY.BLANK },
    { decoyMode: DECOY.RELATED },
    { decoyMode: DECOY.UNRELATED },
    { decoyMode: DECOY.HINT },
    { imposterKnows: false },
    { imposterKnows: true },
    { allowSteal: false },
    { allowCall: false },
    { maxRounds: ROUNDS_UNLIMITED },
    { maxRounds: 2 },
    { roles: ['detective', 'sidekick', 'jester'] },
    { scoring: true },
    { wordLang: 'th' },
    { packIds: [] },
  ];

  for (const change of changes) {
    let state = createGame({ wordLang: 'en' });
    for (const name of ['Ann', 'Ben', 'Cal', 'Dee', 'Eli']) {
      state = reduce(state, { type: 'ADD_PLAYER', name });
    }
    state = reduce(state, { type: 'SET_CONFIG', config: change });
    const dealt = reduce(state, { type: 'START_GAME', seed: 3 });
    assert.ok(dealt.secretWord, `${JSON.stringify(change)} produced a game with no word`);
    assert.ok(
      dealt.imposterIds.length * 2 < dealt.players.length,
      `${JSON.stringify(change)} dealt imposters at parity`,
    );
  }
});
