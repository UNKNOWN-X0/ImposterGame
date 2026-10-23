/**
 * The Detective.
 *
 * Crew, and handed one name they know is innocent. That is a small thing and
 * a powerful one: it does not tell them who the imposter is, it tells them
 * whose word to trust, which is how a table starts reasoning instead of
 * guessing.
 *
 * The name they are given has to be worth something, so it is a plain crew
 * member. A sidekick is technically "not an imposter" and clearing one would
 * be true and useless.
 */

export default {
  id: 'detective',
  side: 'crew',

  /** What their card shows beyond the word: the name they were dealt. */
  reveals: 'cleared',

  /** One innocent name, drawn from the ordinary crew. */
  deal({ plainCrew, rng }) {
    if (plainCrew.length === 0) return {};
    return { clearedId: plainCrew[Math.floor(rng() * plainCrew.length)] };
  },
};
