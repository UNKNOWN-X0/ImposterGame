/**
 * Which screen each phase is shown on, for both ways of playing.
 *
 * There are two modes — one phone passed around, and everybody on their own —
 * and until now each kept its own `switch` over the phases. That is two edits
 * for every new phase and a fair chance of making only one of them: the game
 * would work on one phone and fall through to a blank screen on the other,
 * and nothing would say so until somebody played it that way.
 *
 * So the routing lives here, once. A mode supplies the screens it draws, by
 * name; this decides which name a phase calls for. `screens.test.js` checks
 * that every phase has one and that both modes answer to all of them, so a
 * phase added to the engine fails a test rather than a party.
 */

import { PHASE } from '../core/engine.js';

/** Phase → the name of the screen that shows it. */
export const SCREEN_FOR_PHASE = {
  [PHASE.LOBBY]: 'lobby',
  [PHASE.REVEAL]: 'reveal',
  [PHASE.CLUES]: 'clues',
  [PHASE.VOTE]: 'vote',
  [PHASE.VERDICT]: 'verdict',
  [PHASE.STEAL]: 'steal',
  [PHASE.GAME_OVER]: 'gameOver',
};

/** Every screen name a mode has to be able to draw. */
export const SCREEN_NAMES = Object.freeze([...new Set(Object.values(SCREEN_FOR_PHASE))]);

/**
 * The screen a phase calls for, or null if the engine has grown a phase the
 * screens have not heard of. Null draws nothing, which is better than a
 * component rendering half a game.
 */
export function screenFor(phase) {
  return SCREEN_FOR_PHASE[phase] ?? null;
}

/**
 * Pick a screen out of a mode's own set of them.
 *
 * `screens` is an object of name → function returning what to draw. A mode
 * passes the whole set and gets back the one for this phase, already called.
 */
export function renderPhase(phase, screens) {
  const name = screenFor(phase);
  const draw = name ? screens[name] : null;
  return typeof draw === 'function' ? draw() : null;
}

/** The phases that are a game in progress — not the lobby, not the end. */
export const isPlaying = (phase) => phase !== PHASE.LOBBY && phase !== PHASE.GAME_OVER;
