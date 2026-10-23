/**
 * The packs that ship with the game, fetched a language at a time.
 *
 * One file per language, ten packs of a hundred in each. They are written for
 * their language rather than translated: a German table gets Tatort and a
 * Thai table gets สงกรานต์, because a translated pack gives somebody a word
 * nobody at the table would ever say.
 *
 * They used to be three plain imports, which meant every phone downloaded all
 * three: 206 kB of the bundle, of which a Thai table used 129 and an English
 * one 37. Now each language is its own chunk, fetched when a table actually
 * chooses it.
 *
 * The awkward part, and the reason this is a registry rather than an async
 * `packsFor`: the rules deal the word, and the rules are a synchronous pure
 * reducer. Making them wait on a download would be the wrong end to fix. So
 * loading is something the lobby does *before* a deal, and by the time the
 * reducer asks, the answer is already sitting here.
 *
 * To add a language: write its file beside these, add a line to LOADERS and
 * to WORD_LANGUAGES, and give src/i18n/strings a file to match.
 */

/**
 * One dynamic import per language. Written out rather than built from a
 * template because a bundler has to be able to see each one to split it.
 */
const LOADERS = {
  en: () => import('./en.js'),
  th: () => import('./th.js'),
  de: () => import('./de.js'),
};

export const BUILTIN_LANGUAGES = Object.keys(LOADERS);

const loaded = new Map(); // lang -> packs
const inFlight = new Map(); // lang -> promise, so two asks are one download

/** Are this language's words here yet? */
export const wordsReady = (lang) => loaded.has(lang);

/** Languages whose words are already in memory. */
export const languagesLoaded = () => [...loaded.keys()];

/**
 * Fetch one language's packs, once.
 *
 * Resolves to the packs. A language nobody has heard of resolves to an empty
 * list rather than throwing: a saved game or a newer room can name one, and
 * that is a game with no words, not a crash.
 */
export function loadWords(lang) {
  if (loaded.has(lang)) return Promise.resolve(loaded.get(lang));
  if (!LOADERS[lang]) return Promise.resolve([]);
  if (!inFlight.has(lang)) {
    const job = LOADERS[lang]()
      .then((module) => {
        const packs = module.default ?? [];
        loaded.set(lang, packs);
        inFlight.delete(lang);
        return packs;
      })
      .catch((err) => {
        // A chunk that will not load is a table that cannot play. Forget the
        // attempt so a retry is possible rather than permanently poisoned.
        inFlight.delete(lang);
        throw err;
      });
    inFlight.set(lang, job);
  }
  return inFlight.get(lang);
}

/** Everything, for the server and for tests, where there is nothing to save. */
export function loadAllWords() {
  return Promise.all(BUILTIN_LANGUAGES.map(loadWords));
}

/** Test helper: back to having downloaded nothing. */
export function _forgetWords() {
  loaded.clear();
  inFlight.clear();
}

export default {
  id: 'builtin',
  // Synchronous by design: whatever has been fetched, or nothing.
  packsFor: (lang) => loaded.get(lang) ?? [],
  languages: BUILTIN_LANGUAGES,
};
