/**
 * Which pack a word came from.
 */

import { packById } from '../../content/words/index.js';

/**
 * Which pack the word came from, named on the card under it.
 *
 * Every card says the same thing, an imposter's included. The table is
 * playing to a known category and a secret word — knowing it is "Food &
 * Drink" is what makes a one-word clue mean anything, and it is the frame
 * the imposter has to bluff inside rather than a gift to them. The name is
 * in the language the words are in, not the language of the buttons: it
 * labels the word beside it.
 */
export function PackChip({ lang, packId, customPacks = [] }) {
  const pack = packById(lang, packId, customPacks);
  if (!pack) return null;
  return (
    <span className="pack-chip">
      <span aria-hidden="true">{pack.emoji}</span> {pack.name}
    </span>
  );
}
