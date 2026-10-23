/**
 * The Sidekick.
 *
 * Has the real word, sounds like crew, and wins with the imposter — so they
 * are a vote and a voice on the wrong side of the table, giving clues that
 * are perfectly true and perfectly unhelpful.
 *
 * They count as the imposters' side for taking the table over, but not for
 * catching: a sidekick with no imposter left has nobody to win with, so the
 * crew have already won.
 */

export default {
  id: 'sidekick',
  side: 'imposters',

  /** What their card shows beyond the word: who they are covering for. */
  reveals: 'imposters',
  countsWhenCatching: false,
};
