/**
 * The Jester.
 *
 * Has the word like everybody else, and wins outright by being voted out.
 *
 * The point of them is not the chaos, it is what they do to a vote: with a
 * jester at the table the crew has to be right rather than merely decisive,
 * because the loudest, oddest player might be the one person they must not
 * pick.
 */

export default {
  id: 'jester',
  side: 'nobody',
  endsGameWhenVotedOut: { winner: 'jester', reason: 'jester' },
};
