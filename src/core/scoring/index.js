/**
 * Every way a game can end, and what it pays.
 *
 * A win is not a win: running the clock out is not the same as calling the
 * word out loud in front of everybody, and voting out every imposter without
 * losing a single crew member is not the same as scraping it at two against
 * three. The bolder the road, the more it pays — which gives an imposter a
 * reason to call, and a crew a reason to be careful rather than merely
 * decisive.
 *
 * Each ending is an entry: who won, what it pays, and — for the crew, who
 * only get paid if they are still in — whether being eliminated costs you
 * your share. The engine looks a reason up here rather than naming each one,
 * so a new way to win is an entry in this table, its sentence in src/i18n,
 * and the line in the rules that produces it.
 *
 * These numbers are the whole balance of the scoreboard. Change one here and
 * the settings tip, the lobby's list of what each win is worth, and the end
 * of the game all follow.
 */

export const WIN_REASONS = {
  // Crew
  caught: { winner: 'crew', points: 1, paysTheEliminated: false },
  cleanSweep: { winner: 'crew', points: 2, paysTheEliminated: false },

  // Imposters — paid whether or not they survived, because they won
  time: { winner: 'imposters', points: 1, paysTheEliminated: true },
  outnumbered: { winner: 'imposters', points: 2, paysTheEliminated: true },
  steal: { winner: 'imposters', points: 2, paysTheEliminated: true },
  called: { winner: 'imposters', points: 3, paysTheEliminated: true },

  // The jester, alone
  jester: { winner: 'jester', points: 3, paysTheEliminated: true },
};

/** What one ending pays each winner. Unknown reasons pay the minimum. */
export const pointsFor = (reason) => WIN_REASONS[reason]?.points ?? 1;

/** Whether somebody voted out still shares in this win. */
export const paysTheEliminated = (reason) => WIN_REASONS[reason]?.paysTheEliminated ?? true;

/** The old shape, kept because the settings and the scoreboard read it. */
export const WIN_POINTS = Object.fromEntries(
  Object.entries(WIN_REASONS).map(([reason, spec]) => [reason, spec.points]),
);

/** The most any one game can pay a single player. */
export const MAX_WIN_POINTS = Math.max(...Object.values(WIN_POINTS));
