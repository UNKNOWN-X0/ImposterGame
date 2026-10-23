/**
 * Getting a game into a particular state, without writing it out each time.
 *
 * Most tests of the rules begin the same way: six people, these settings,
 * deal, everyone looks at their card, now check the thing the test is about.
 * Written out by hand that is twelve lines of setup above two lines of test,
 * and the setup is where the mistakes hide — a test that quietly never
 * reached the phase it claims to be testing still passes.
 *
 * So these do the setup and assert that it worked. `aGame()` returns a game
 * in the phase you asked for or throws, which means a test that says it is
 * about voting really is.
 */

import assert from 'node:assert/strict';

import { createGame, reduce, currentTurn, PHASE } from '../core/engine.js';

/** Enough names for the largest table the game allows. */
export const NAMES = [
  'Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay',
  'Gus', 'Hal', 'Ivy', 'Jo', 'Kit', 'Lou',
];

/**
 * A game with people at the table, dealt from a fixed seed.
 *
 * @param players how many, or a list of names
 * @param config  anything the table would set
 * @param seed    the same seed always deals the same game
 * @param phase   play forward to here, or stay in the lobby
 */
export function aGame({ players = 5, config = {}, seed = 1, phase = PHASE.LOBBY } = {}) {
  const names = Array.isArray(players) ? players : NAMES.slice(0, players);
  let state = createGame(config);
  for (const name of names) state = reduce(state, { type: 'ADD_PLAYER', name });
  if (phase === PHASE.LOBBY) return state;

  state = reduce(state, { type: 'START_GAME', seed });
  if (phase === PHASE.REVEAL) return state;

  for (const id of state.order) state = reduce(state, { type: 'MARK_REVEALED', playerId: id });
  assert.equal(state.phase, PHASE.CLUES, 'everyone looked, so it should be time to talk');
  if (phase === PHASE.CLUES) return state;

  state = everyoneSpeaks(state);
  assert.equal(state.phase, PHASE.VOTE, 'everyone spoke, so it should be time to vote');
  if (phase === PHASE.VOTE) return state;

  throw new Error(`aGame cannot set up ${phase} — get to ${PHASE.VOTE} and take it from there`);
}

/** One clue from everybody still in, in the order the engine asks for them. */
export function everyoneSpeaks(state, text = (n) => `clue${n}`) {
  let next = state;
  let n = 0;
  let guard = 0;
  while (next.phase === PHASE.CLUES && guard++ < 40) {
    const turn = currentTurn(next);
    if (!turn) break;
    next = reduce(next, { type: 'SUBMIT_CLUE', playerId: turn, text: text(n++) });
  }
  return next;
}

/** Everyone alive votes for one player, which resolves the round. */
export function everyoneVotesFor(state, targetId) {
  let next = state;
  for (const player of next.players) {
    if (next.eliminated.includes(player.id) || player.id === targetId) continue;
    if (next.phase !== PHASE.VOTE) break;
    next = reduce(next, { type: 'CAST_VOTE', voterId: player.id, targetId });
  }
  return next;
}

/** The ids of everyone on a given side, which tests need constantly. */
export const impostersIn = (state) => state.imposterIds;
export const crewIn = (state) =>
  state.players.map((p) => p.id).filter((id) => !state.imposterIds.includes(id));
export const whoIs = (state, role) =>
  Object.keys(state.roles ?? {}).filter((id) => state.roles[id] === role);

/**
 * Play until the game ends, taking whatever branch the caller describes.
 *
 * `vote` is asked who should go each round; returning null is a tie. This is
 * how a test drives a whole game without spelling out every action, and it
 * throws rather than looping forever if the rules ever stop making progress.
 */
export function playOut(state, { vote = (s) => s.imposterIds[0], steal = null } = {}) {
  let next = state;
  let guard = 0;
  while (next.phase !== PHASE.GAME_OVER) {
    if (guard++ > 60) throw new Error(`the game stopped making progress in ${next.phase}`);
    if (next.phase === PHASE.CLUES) {
      next = everyoneSpeaks(next, (n) => `c${guard}x${n}`);
      if (next.phase === PHASE.CLUES) next = reduce(next, { type: 'FORCE_VOTE' });
    } else if (next.phase === PHASE.VOTE) {
      next = reduce(next, { type: 'DECLARE_ELIMINATION', playerId: vote(next) ?? null });
    } else if (next.phase === PHASE.VERDICT) {
      next = reduce(next, { type: 'CONTINUE' });
    } else if (next.phase === PHASE.STEAL) {
      const guess = steal === null ? 'not the word' : steal === true ? next.secretWord : steal;
      next = reduce(next, { type: 'STEAL_GUESS', text: guess });
    } else {
      throw new Error(`playOut does not know what to do in ${next.phase}`);
    }
  }
  return next;
}
