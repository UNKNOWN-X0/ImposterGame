/**
 * The phases a game moves through, in order.
 *
 * Every screen is one of these, and the reducer only ever moves between them
 * — there is no fifth place a game can be.
 */

export const PHASE = {
  LOBBY: 'lobby',
  REVEAL: 'reveal',
  CLUES: 'clues',
  VOTE: 'vote',
  VERDICT: 'verdict',
  STEAL: 'steal',
  GAME_OVER: 'game_over',
};
