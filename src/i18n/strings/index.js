/**
 * Interface strings, one file per language, fetched as they are needed.
 *
 * Flat keys, because a screen asks for `settings.packs` and should not have
 * to know which corner of a tree it lives in. English is the fallback: a key
 * missing anywhere else resolves to en rather than showing the reader a raw
 * key, so a half-finished translation is still a playable game.
 *
 * Counted strings take a `count` param and are looked up as `key_one` /
 * `key_other` first; see ../translate.js for which one wins.
 *
 * ## Why English is not split
 *
 * The other two are: between them they were 116 kB of the bundle, downloaded
 * by every phone including the ones reading neither. English stays a plain
 * import on purpose, because it is the fallback. If the fallback itself had
 * to be fetched, then every key in the app would resolve to its own raw name
 * for as long as the download took, and the first paint of a cold start would
 * be a screen of `home.headline` and `lobby.deal`. A reader of English pays
 * nothing for this; a reader of Thai pays 27 kB and gets a screen that is
 * never broken, only briefly English.
 *
 * `STRINGS` is filled in rather than rebuilt, so `translate` stays
 * synchronous and the screens that call `t()` never learn that any of this
 * happens.
 *
 * To add a language: write its file beside these, add a line to LOADERS and
 * to LANGUAGES, and add a word pack in src/content/words/builtin/.
 */

import en from './en.js';

export const LANGUAGES = [
  { id: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { id: 'th', label: 'ไทย', short: 'ไทย', flag: '🇹🇭' },
  { id: 'de', label: 'Deutsch', short: 'DE', flag: '🇩🇪' },
];

export const FALLBACK_LANG = 'en';

/** One dynamic import each, spelled out so a bundler can see them. */
const LOADERS = {
  th: () => import('./th.js'),
  de: () => import('./de.js'),
};

/**
 * What is in memory. English is always here; the others appear as they
 * arrive. Mutated rather than replaced, because `translate` holds a
 * reference to it.
 */
export const STRINGS = { en };

const inFlight = new Map();

/** Can this language be read right now, or only fallen back from? */
export const stringsReady = (lang) => Boolean(STRINGS[lang]);

/**
 * Fetch one language's strings, once.
 *
 * A language that fails to load leaves the reader in English, which is a
 * worse evening than it should be but still a playable game — so this
 * resolves either way and never takes a screen down with it.
 */
export function loadStrings(lang) {
  if (STRINGS[lang]) return Promise.resolve(STRINGS[lang]);
  if (!LOADERS[lang]) return Promise.resolve(STRINGS[FALLBACK_LANG]);
  if (!inFlight.has(lang)) {
    const job = LOADERS[lang]()
      .then((module) => {
        STRINGS[lang] = module.default;
        inFlight.delete(lang);
        return STRINGS[lang];
      })
      .catch(() => {
        inFlight.delete(lang);
        return STRINGS[FALLBACK_LANG];
      });
    inFlight.set(lang, job);
  }
  return inFlight.get(lang);
}

/** Everything, for the tests and the checks that compare languages. */
export function loadAllStrings() {
  return Promise.all(LANGUAGES.map((l) => loadStrings(l.id)));
}

/** Test helper: back to English only. */
export function _forgetStrings() {
  for (const key of Object.keys(STRINGS)) {
    if (key !== FALLBACK_LANG) delete STRINGS[key];
  }
  inFlight.clear();
}
