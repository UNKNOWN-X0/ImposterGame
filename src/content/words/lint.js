/**
 * Whether a pair is any good.
 *
 * The suite already checks that the packs are the right *shape*: ten packs a
 * language, a hundred pairs each, no word twice. None of that says anything
 * about whether a pair works at a table, and a pair that does not work is
 * worse than a missing one — it ends the round early and nobody knows why.
 *
 * Four things go wrong, and all four are invisible when you are the person
 * who wrote the pack:
 *
 *  - The near miss IS the word. `Pizza / pizza`, `Café / Cafe`. The imposter
 *    reads their card, says the word out loud in total innocence, and the
 *    round is over before the first clue.
 *  - The near miss is the same word in a different coat. `Dog / Dogs`,
 *    `Laufen / Läufen`. Any clue that fits one fits the other, so the
 *    imposter cannot be caught by their clue — only by their face.
 *  - The hint gives it away. Hint mode shows the imposter a category, and if
 *    the category contains the word, it is not a category, it is the answer.
 *  - The near miss is somebody else's word in the same pack. A clue that
 *    points at the decoy now points at a real answer too, which makes the
 *    crew argue about the wrong thing.
 *
 * Findings are codes, in the same spirit as the rest of the game: the test
 * suite prints them, and the pack editor could show them next to the line
 * they came from.
 */

import { normalise as engineNormalise } from '../../core/engine.js';

/**
 * How this file decides two words are the same.
 *
 * Stricter than the engine's `normalise`, on purpose. The engine folds what
 * it must to judge a guess fairly and no more; a linter is asking a different
 * question — could a table tell these apart — and for that, `Café` and
 * `Cafe` are one word. Nothing here affects how a game is played.
 *
 * The accents come off **only where the letter underneath is Latin**. The
 * first version of this took every combining mark off everything, which is
 * correct for `é` and badly wrong for Thai: Thai vowels and tone marks are
 * combining marks too, so it turned ถังขยะ (a bin) and ถุงขยะ (a bin bag)
 * into the same string and reported a perfectly good pair as broken. It
 * found two such "faults" in the Thai packs, both of them real words.
 */
const foldLatinAccents = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC');

const normalise = (s) => engineNormalise(foldLatinAccents(s));

/** Endings that make a word the same word. Checked longest first. */
const INFLECTIONS = {
  // English
  en: ['es', 's', 'ing', 'ed', 'er', 'ers'],
  // German plurals and the easy cases; the hard ones are not worth guessing.
  de: ['en', 'er', 'nen', 'n', 'e', 's'],
  // Thai has no inflection of this kind, which is why it is not listed.
};

/**
 * Is `b` just `a` wearing a different ending?
 *
 * Only in one direction that matters: the longer one has to be the shorter
 * one plus an ending. Deliberately strict about the stem — four characters,
 * so `Ant / Ants` is caught but `Ice / Iced` is not treated as the same idea
 * as `I`.
 */
export function sameWordDifferentEnding(a, b, lang = 'en') {
  const one = normalise(a);
  const two = normalise(b);
  if (!one || !two || one === two) return false;
  const [short, long] = one.length <= two.length ? [one, two] : [two, one];
  if (short.length < 4) return false;
  if (!long.startsWith(short)) return false;
  const ending = long.slice(short.length);
  return (INFLECTIONS[lang] ?? INFLECTIONS.en).includes(ending);
}

/**
 * Every complaint about one pack, as `{ at, word, why }`.
 *
 * `at` is the position in the pack, so an editor can point at a line.
 */
export function lintPack(pack) {
  const findings = [];
  if (!pack || !Array.isArray(pack.pairs)) return findings;

  const lang = pack.lang ?? 'en';
  const hint = normalise(pack.hint);
  const words = new Map(); // normalised word -> position, for the decoy check
  pack.pairs.forEach((pair, index) => {
    if (pair?.word) words.set(normalise(pair.word), index);
  });

  pack.pairs.forEach((pair, index) => {
    const at = index + 1;
    const word = normalise(pair?.word);
    const decoy = normalise(pair?.decoy);
    const say = (why, extra) => findings.push({ at, word: pair?.word, why, ...extra });

    if (!word) {
      say('emptyWord');
      return;
    }

    // The hint is the pack's category line. If the word is in it, hint mode
    // is handing the imposter the answer.
    if (hint && (hint.includes(word) || (word.includes(hint) && hint.length >= 4))) {
      say('hintGivesItAway', { hint: pack.hint });
    }

    if (!decoy) return; // no near miss is a legitimate choice, not a fault

    if (decoy === word) {
      say('decoyIsTheWord', { decoy: pair.decoy });
      return;
    }
    if (sameWordDifferentEnding(word, decoy, lang)) {
      say('decoyIsTheSameWord', { decoy: pair.decoy });
    }
    const elsewhere = words.get(decoy);
    if (elsewhere !== undefined && elsewhere !== index) {
      say('decoyIsAnotherAnswer', { decoy: pair.decoy, alsoAt: elsewhere + 1 });
    }
  });

  return findings;
}

/** Every complaint about a list of packs, each tagged with its pack. */
export function lintPacks(packs = []) {
  return packs.flatMap((pack) =>
    lintPack(pack).map((finding) => ({ pack: pack.id ?? pack.name, ...finding })),
  );
}
