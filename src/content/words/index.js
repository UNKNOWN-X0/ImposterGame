/**
 * Word packs, by language.
 *
 * The word language belongs to the game, not to the device: everyone at one
 * table has to be guessing the same word. The interface language is a
 * separate, per-device choice (see src/i18n).
 *
 * This file is the one everything else asks. Which packs exist and where they
 * come from is ./sources.js; what a pack written by a table looks like is
 * ./custom.js. To add a language, see ./builtin/index.js.
 */

import builtin, {
  BUILTIN_LANGUAGES,
  loadAllWords as fetchAllWords,
  loadWords as fetchWords,
  wordsReady,
  _forgetWords as forgetWords,
} from './builtin/index.js';
import { packsFrom } from './sources.js';

export { wordsReady, BUILTIN_LANGUAGES };

/**
 * Fetch a language's packs, and throw away anything worked out before they
 * arrived.
 *
 * This wrapper is not decoration. `poolFor` below caches the flattened pool,
 * which was free of consequences while the packs were plain imports: the
 * answer could not change while the app was running. Now it can — and the
 * settings screen asks for a word count on every render, including the
 * renders that happen while a language is still in the air. The first of
 * those cached an EMPTY pool under the key the deal would later use, so the
 * words arrived, the button went green, and the deal failed with "no packs".
 *
 * Found by the browser sweep, which is exactly the sort of thing it is for:
 * every unit test had the languages loaded before it started.
 */
export function loadWords(lang) {
  return fetchWords(lang).then((packs) => {
    poolCache.clear();
    return packs;
  });
}

export function loadAllWords() {
  return fetchAllWords().then((all) => {
    poolCache.clear();
    return all;
  });
}

/** Test helper: back to having downloaded nothing. */
export function _forgetWords() {
  forgetWords();
  poolCache.clear();
}

export const WORD_LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'th', label: 'ไทย', flag: '🇹🇭' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export const DEFAULT_WORD_LANG = 'en';

/**
 * Every pack for a language, ours first and the table's after.
 *
 * A language nothing has been written for falls back to English rather than
 * dealing an empty game.
 */
export function packsFor(lang = DEFAULT_WORD_LANG, customPacks = []) {
  // A language we ship but have not fetched yet must NOT fall back to
  // English. Falling back would quietly deal English words to a Thai table
  // and nothing would look wrong until somebody read their card — far worse
  // than the loud, already-handled "no packs" that an empty list produces.
  // Only a language we have never heard of falls back.
  const known = BUILTIN_LANGUAGES.includes(lang) || builtin.packsFor(lang).length
    ? lang
    : DEFAULT_WORD_LANG;
  return packsFrom(known, { customPacks });
}

/**
 * One pack by id, for naming the pack a dealt word came from.
 *
 * Returns null rather than throwing: a saved game could name a pack that no
 * longer exists, and a card with no label on it is better than a blank screen.
 */
export function packById(lang, id, customPacks = []) {
  if (!id) return null;
  return packsFor(lang, customPacks).find((pack) => pack.id === id) ?? null;
}

/**
 * Every pair from the chosen packs, flattened. `packIds` empty = all packs.
 *
 * Each pair carries its pack's `hint` — the category line shown in hint mode.
 * A pair may override it with its own `hint` if you want to write something
 * sharper for a particular word; nothing in the packs does yet.
 *
 * Results are cached by language and selection. A full pool is a thousand
 * objects, and the settings screen asks for the count on every keystroke —
 * rebuilding that list each time was wasted work for an answer that cannot
 * change while the app is running.
 */
const poolCache = new Map();

/**
 * A short stamp of what is actually in a pack.
 *
 * The cache key used to be `id:pairs.length`, which is not what is in a pack
 * — it is how much. Editing a pack keeps its id, and replacing its words
 * keeps the count, so a table that rewrote all five words of their pack went
 * on being dealt the five they had deleted for the rest of the session, and
 * the new ones could never come up at all. Adding or removing one entry hid
 * it, because then the count moved and the cache turned over, which is why
 * it survived every casual try.
 *
 * FNV-1a over the words and decoys: a few hundred characters per pack, run
 * on a settings keystroke, and no collision that matters — a wrong answer
 * here means a stale pool, not a wrong game.
 */
const stamp = (pack) => {
  let h = 0x811c9dc5;
  for (const pair of pack.pairs) {
    const text = `${pair.word}\u0000${pair.decoy ?? ''}\u0001`;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36);
};

export function poolFor(lang = DEFAULT_WORD_LANG, packIds = [], customPacks = []) {
  // Packs written by the table join the built-in ones for the language they
  // were written in. They are not cached by id alone — a pack can be edited
  // in place, so the cache key stamps what is in it.
  const mine = customPacks.filter((pack) => pack && pack.lang === lang);
  const fingerprint = mine.map((pack) => `${pack.id}:${stamp(pack)}`).join(',');
  const key = `${lang}|${[...packIds].sort().join(',')}|${fingerprint}`;
  const cached = poolCache.get(key);
  // An empty pool is never worth remembering: either this language has not
  // arrived yet, or there is genuinely nothing to deal. Both are cheap to
  // work out again, and remembering the first is how a loaded language ends
  // up dealing nothing.
  if (cached && cached.length) return cached;

  const all = packsFor(lang, customPacks);
  const chosen = packIds.length ? all.filter((p) => packIds.includes(p.id)) : all;
  // An unknown pack id (left over from another language, or a custom pack
  // that has since been deleted) falls back to everything rather than
  // dealing an empty game.
  const packs = chosen.length ? chosen : all;
  const pool = packs.flatMap((p) =>
    p.pairs.map((pair) => ({ ...pair, packId: p.id, hint: pair.hint || p.hint })),
  );
  poolCache.set(key, pool);
  return pool;
}

/** Totals for the settings screen. */
export function pairCount(lang, packIds = [], customPacks = []) {
  return poolFor(lang, packIds, customPacks).length;
}
