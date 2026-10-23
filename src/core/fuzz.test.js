/**
 * The reducer, fed nonsense on purpose.
 *
 * engine.test.js plays games the way a table plays them, and the behaviour
 * fingerprint plays 400 more by a fixed script. Both are scripts: they find
 * what somebody already thought to write down. This does not check what the
 * game does — it checks what the game must never do, whatever it is asked:
 *
 *   - a refusal is always a GameError with a code, never a TypeError
 *   - every id in a state belongs to somebody at the table
 *   - nobody is eliminated twice, nobody is dealt two roles
 *   - a vote is cast by someone still in the game
 *   - points never go down, except when the table clears them
 *   - a finished game stays finished until somebody deals again
 *   - the state handed in is never the state handed back, changed
 *
 * Actions are picked at random from everything the app can send, including
 * ones that make no sense in the current phase, because that is exactly what
 * a stale button on a slow phone sends. Being refused is a pass; crashing is
 * not.
 *
 * Every run is seeded and the seed is printed on failure, so a one-in-a-
 * thousand sequence can be replayed exactly:  FUZZ_SEED=12345 npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createGame,
  reduce,
  alivePlayers,
  currentTurn,
  pendingVoters,
  GameError,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE,
  ROLES,
} from './engine.js';
import { mulberry32 } from './rng.js';
import '../testing/ready.js';

const NAMES = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ida', 'Jon', 'Kim', 'Lou'];
const ROLE_IDS = new Set(ROLES.map((r) => r.id).concat(['crew', 'imposter']));
const PHASES = new Set(Object.values(PHASE));

/* ------------------------------------------------------------------ *
 * What must be true of every state, always
 * ------------------------------------------------------------------ */

function check(state, trail) {
  const where = (what) => `${what}\n  after: ${trail.join(' → ')}`;
  const ids = new Set(state.players.map((p) => p.id));
  const known = (id) => ids.has(id);

  assert.ok(PHASES.has(state.phase), where(`phase "${state.phase}" is not a phase`));
  assert.ok(state.players.length <= MAX_PLAYERS, where('more players than a table holds'));
  assert.equal(ids.size, state.players.length, where('two players share an id'));

  const names = state.players.map((p) => p.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, where('two players share a name'));

  for (const [key, list] of Object.entries({
    order: state.order,
    imposterIds: state.imposterIds,
    eliminated: state.eliminated,
    revealed: state.revealed,
    lastWinners: state.lastWinners,
  })) {
    assert.ok(Array.isArray(list), where(`${key} is not a list`));
    assert.equal(new Set(list).size, list.length, where(`${key} names somebody twice`));
    for (const id of list) assert.ok(known(id), where(`${key} names "${id}", who is not here`));
  }

  for (const [id, role] of Object.entries(state.roles)) {
    assert.ok(known(id), where(`a role is dealt to "${id}", who is not here`));
    assert.ok(ROLE_IDS.has(role), where(`"${role}" is not a role`));
  }

  for (const [voter, target] of Object.entries(state.votes)) {
    assert.ok(known(voter), where(`a vote from "${voter}", who is not here`));
    assert.ok(known(target), where(`a vote for "${target}", who is not here`));
    // Only while a vote is open. The fuzzer flagged this as a bug on its
    // first real run and it is not one: after a round is declared, the votes
    // of that round stay on the verdict card, and one of them is usually the
    // person who was just voted out. What would be a bug is a dead player's
    // vote still sitting there when a NEW tally is being taken — and the
    // engine clears the box on the way into every vote, so it cannot be.
    if (state.phase === PHASE.VOTE) {
      assert.ok(!state.eliminated.includes(voter), where('a voted-out player is voting'));
    }
  }

  for (const [id, points] of Object.entries(state.scores)) {
    assert.ok(known(id), where(`points for "${id}", who is not here`));
    assert.ok(Number.isInteger(points) && points >= 0, where(`"${points}" is not a score`));
  }

  assert.ok(Number.isInteger(state.round) && state.round >= 0, where('round is not a number'));
  assert.ok(
    Number.isInteger(state.gamesPlayed) && state.gamesPlayed >= 0,
    where('gamesPlayed is not a number'),
  );

  if (state.phase === PHASE.GAME_OVER) {
    assert.ok(state.result, where('the game is over and nobody won'));
    assert.ok(state.result.reason, where('the game ended for no reason'));
    assert.ok(['crew', 'imposters', 'jester'].includes(state.result.winner), where('won by whom?'));
  }

  if (state.phase !== PHASE.LOBBY) {
    assert.ok(state.secretWord, where('a game in progress with no word'));
    assert.ok(state.imposterIds.length >= 1, where('a game in progress with no imposter'));
    assert.ok(
      state.imposterIds.length < state.players.length,
      where('everybody is an imposter'),
    );
    assert.equal(state.order.length, state.players.length, where('somebody is not in the order'));
  }
}

/* ------------------------------------------------------------------ *
 * Choosing what to do next
 * ------------------------------------------------------------------ */

/**
 * The first version of this picked uniformly from every action, and it was
 * useless: it never got past the reveal phase. Picking MARK_REVEALED for a
 * random player when four of them still have cards to look at almost never
 * clears the table, and RESET and PLAY_AGAIN kept throwing it back to the
 * lobby, so 300 runs of 80 steps reached exactly two phases and zero endings.
 * It passed every assertion by never going anywhere.
 *
 * So most moves are now sensible ones for the phase the game is actually in,
 * and a quarter are nonsense. The nonsense is the point — a stale button on
 * a slow phone sends a vote during the verdict — but it has to be a minority
 * or the game never gets far enough for the nonsense to be interesting.
 */
function sensibleAction(state, rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const chance = (p) => rnd() < p;
  const alive = alivePlayers(state);

  switch (state.phase) {
    case PHASE.LOBBY: {
      if (state.players.length < MIN_PLAYERS) return { type: 'ADD_PLAYER', name: pick(NAMES) };
      if (chance(0.15)) return { type: 'ADD_PLAYER', name: pick(NAMES) };
      if (chance(0.2)) return someConfig(rnd);
      return { type: 'START_GAME', seed: Math.floor(rnd() * 1e9) };
    }

    case PHASE.REVEAL: {
      // Whoever has not looked yet, which is how a table actually does it.
      const waiting = state.players.filter((p) => !state.revealed.includes(p.id));
      return { type: 'MARK_REVEALED', playerId: (pick(waiting) ?? pick(state.players)).id };
    }

    case PHASE.CLUES: {
      if (chance(0.05)) return { type: 'FORCE_VOTE' };
      if (chance(0.06)) {
        // An imposter who fancies their chances calls it.
        const caller = pick(state.imposterIds.filter((id) => !state.eliminated.includes(id)));
        if (caller) {
          return {
            type: 'CALL_WORD',
            playerId: caller,
            text: chance(0.5) ? state.secretWord : 'not the word',
          };
        }
      }
      const up = currentTurn(state);
      return { type: 'SUBMIT_CLUE', playerId: up ?? pick(alive)?.id, text: `clue${state.clues.length}` };
    }

    case PHASE.VOTE: {
      // Half the tables vote in the app; the other half vote out loud and
      // whoever holds the phone declares it.
      if (chance(0.25)) {
        return { type: 'DECLARE_ELIMINATION', playerId: chance(0.1) ? null : pick(alive)?.id };
      }
      const waiting = pendingVoters(state);
      const voter = pick(waiting) ?? pick(alive);
      const target = pick(alive.filter((p) => p.id !== (voter?.id ?? voter)));
      return {
        type: 'CAST_VOTE',
        voterId: voter?.id ?? voter,
        targetId: target?.id ?? pick(alive)?.id,
      };
    }

    case PHASE.VERDICT:
      return { type: 'CONTINUE' };

    case PHASE.STEAL:
      return { type: 'STEAL_GUESS', text: chance(0.3) ? state.secretWord : 'not the word' };

    case PHASE.GAME_OVER:
      return chance(0.2) ? { type: 'RESET' } : { type: 'PLAY_AGAIN' };

    default:
      return { type: 'CONTINUE' };
  }
}

function someConfig(rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  return {
    type: 'SET_CONFIG',
    config: pick([
      { imposterCount: pick([1, 2, 3, 'auto', 'random', 0, 99]) },
      { decoyMode: pick(['blank', 'related', 'unrelated', 'hint', 'nonsense']) },
      { maxRounds: pick([0, 1, 3, 5, -1]) },
      { roles: pick([[], ['detective'], ['detective', 'sidekick', 'jester'], ['timelord']]) },
      { scoring: pick([true, false]) },
      { allowSteal: pick([true, false]) },
      { allowCall: pick([true, false]) },
      { wordLang: pick(['en', 'th', 'de', 'xx']) },
    ]),
  };
}

/** Anything at all, in any phase — the stale button, the double tap. */
function chaosAction(state, rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const anyone = () => pick(state.players)?.id ?? 'nobody';
  const alive = () => pick(alivePlayers(state))?.id ?? anyone();

  return pick([
    () => ({ type: 'ADD_PLAYER', name: pick(NAMES) }),
    () => ({ type: 'REMOVE_PLAYER', playerId: anyone() }),
    () => someConfig(rnd),
    () => ({ type: 'START_GAME', seed: Math.floor(rnd() * 1e9) }),
    () => ({ type: 'MARK_REVEALED', playerId: anyone() }),
    () => ({ type: 'SUBMIT_CLUE', playerId: anyone(), text: pick(['cat', 'x', '', '  ']) }),
    () => ({ type: 'FORCE_VOTE' }),
    () => ({ type: 'CAST_VOTE', voterId: alive(), targetId: alive() }),
    () => ({ type: 'DECLARE_ELIMINATION', playerId: pick([alive(), null]) }),
    () => ({ type: 'CALL_WORD', playerId: anyone(), text: pick([state.secretWord ?? 'x', 'wrong']) }),
    () => ({ type: 'STEAL_GUESS', text: pick([state.secretWord ?? 'x', 'wrong']) }),
    () => ({ type: 'CONTINUE' }),
    () => ({ type: 'PLAY_AGAIN' }),
    () => ({ type: 'CLEAR_SCORES' }),
    () => ({ type: 'RESET' }),
    () => ({ type: 'SET_CUSTOM_PACKS', packs: [] }),
    // Things no screen sends, which is rather the point.
    () => ({ type: 'NONSENSE' }),
    () => ({ type: 'CAST_VOTE' }),
    () => ({ type: 'ADD_PLAYER' }),
  ])();
}

/** Mostly play the game; sometimes do something absurd. */
function someAction(state, rnd) {
  return rnd() < 0.25 ? chaosAction(state, rnd) : sensibleAction(state, rnd);
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

const RUNS = Number(process.env.FUZZ_RUNS ?? 300);
const STEPS = Number(process.env.FUZZ_STEPS ?? 80);
const FIRST = Number(process.env.FUZZ_SEED ?? 1);

test('whatever it is asked, the rules keep their own promises', () => {
  for (let run = 0; run < RUNS; run++) {
    const seed = FIRST + run;
    const rnd = mulberry32(seed);
    const trail = [`seed ${seed}`];

    let state = createGame({ wordLang: 'en' });
    // Start most runs with a table, so the fuzzer spends its time in a game
    // rather than failing to fill a lobby.
    const seats = 3 + Math.floor(rnd() * 6);
    for (const name of NAMES.slice(0, seats)) {
      state = reduce(state, { type: 'ADD_PLAYER', name });
    }

    check(state, trail);

    for (let i = 0; i < STEPS; i++) {
      const action = someAction(state, rnd);
      const before = JSON.stringify(state);
      const wasOver = state.phase === PHASE.GAME_OVER;
      const scoresBefore = { ...state.scores };

      let next = state;
      try {
        next = reduce(state, action);
      } catch (err) {
        // A refusal is a pass. Anything that is not a refusal is a crash
        // dressed up as one.
        assert.ok(
          err instanceof GameError,
          `${action.type} threw ${err.name}: ${err.message}\n  after: ${trail.join(' → ')}`,
        );
        assert.ok(err.code, `a refusal with no code, after ${trail.join(' → ')}`);
        trail.push(`${action.type}✗${err.code}`);
        assert.equal(JSON.stringify(state), before, 'a refused action still changed the state');
        continue;
      }

      trail.push(action.type);
      assert.equal(JSON.stringify(state), before, `${action.type} changed the state it was given`);
      check(next, trail);

      // Points go up, or stay, or are cleared on purpose. They never slip.
      if (action.type !== 'CLEAR_SCORES') {
        for (const [id, had] of Object.entries(scoresBefore)) {
          if (next.players.some((p) => p.id === id)) {
            assert.ok(
              (next.scores[id] ?? 0) >= had,
              `${id} lost points on ${action.type}\n  after: ${trail.join(' → ')}`,
            );
          }
        }
      }

      // A finished game stays finished until somebody deals again.
      if (wasOver && next.phase !== PHASE.GAME_OVER) {
        assert.ok(
          ['PLAY_AGAIN', 'RESET', 'START_GAME', 'REMOVE_PLAYER', 'ADD_PLAYER'].includes(action.type),
          `${action.type} un-finished a finished game\n  after: ${trail.join(' → ')}`,
        );
      }

      state = next;
    }
  }
});

test('a game played at random always ends, or is still legally in progress', () => {
  // The worry is a state the rules cannot leave: every clue in, every vote
  // cast, and no action that moves it on. A table in that position has to
  // close the tab.
  for (let seed = 1; seed <= 120; seed++) {
    const rnd = mulberry32(seed * 7919);
    let state = createGame({ wordLang: 'en', maxRounds: 3 });
    for (const name of NAMES.slice(0, 3 + (seed % 5))) {
      state = reduce(state, { type: 'ADD_PLAYER', name });
    }
    state = reduce(state, { type: 'START_GAME', seed });

    let moved = 0;
    for (let i = 0; i < 400 && state.phase !== PHASE.GAME_OVER; i++) {
      const before = state;
      try {
        state = reduce(state, someAction(state, rnd));
      } catch {
        /* refused, try another */
      }
      if (state !== before) moved += 1;
    }

    assert.ok(
      state.phase === PHASE.GAME_OVER || moved > 0,
      `seed ${seed}: the game is stuck in ${state.phase} with nothing that moves it`,
    );
  }
});

test('the fuzzer actually gets somewhere', () => {
  /**
   * A fuzzer that passes by never leaving the lobby is worse than no fuzzer,
   * because it reads like coverage. The first version of this file did
   * exactly that — 300 runs reached two phases and zero endings, and every
   * assertion passed. So the fuzzer is held to its own standard: it has to
   * visit every phase the engine has and reach most of the ways a game can
   * end, or it has stopped being a test of anything.
   */
  const phases = new Set();
  const endings = new Set();
  let moved = 0;
  let refused = 0;

  for (let seed = 1; seed <= 200; seed++) {
    const rnd = mulberry32(seed);
    let state = createGame({ wordLang: 'en' });
    for (const name of NAMES.slice(0, 3 + Math.floor(rnd() * 6))) {
      state = reduce(state, { type: 'ADD_PLAYER', name });
    }
    for (let i = 0; i < 80; i++) {
      phases.add(state.phase);
      try {
        const next = reduce(state, someAction(state, rnd));
        if (next.phase === PHASE.GAME_OVER && state.phase !== PHASE.GAME_OVER) {
          endings.add(next.result.reason);
        }
        state = next;
        moved += 1;
      } catch {
        refused += 1;
      }
    }
  }

  for (const phase of Object.values(PHASE)) {
    assert.ok(phases.has(phase), `the fuzzer never reached the ${phase} phase`);
  }
  assert.ok(endings.size >= 5, `only ${endings.size} ways of ending reached: ${[...endings]}`);
  // Both halves matter: all refusals means it never plays, no refusals means
  // it never sends the stale button.
  assert.ok(moved > 2000, `only ${moved} actions did anything`);
  assert.ok(refused > 500, `only ${refused} actions were refused — where is the nonsense?`);
});
