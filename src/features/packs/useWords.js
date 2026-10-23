/**
 * Having a language's words in hand before they are needed.
 *
 * The packs are fetched a language at a time (see
 * src/content/words/builtin), which keeps two languages nobody is playing in
 * off the first download. The cost is that there is now a moment — usually a
 * few milliseconds, longer on a bad connection — when a language has been
 * chosen and its words have not arrived.
 *
 * That moment belongs to the lobby, not to the rules. The reducer deals
 * synchronously and must keep doing so; what this gives the lobby is a plain
 * boolean for whether the deal can go ahead yet.
 */

import { useEffect, useState } from 'react';
import { loadWords, wordsReady } from '../../content/words/index.js';

/**
 * True once this language's words are here.
 *
 * Also true immediately if they already were, so a table that is not
 * changing language never sees a disabled button at all.
 */
export function useWords(lang) {
  const [ready, setReady] = useState(() => wordsReady(lang));

  useEffect(() => {
    if (wordsReady(lang)) {
      setReady(true);
      return undefined;
    }
    setReady(false);
    let stale = false;
    loadWords(lang)
      .then(() => {
        // Somebody who changed language twice while a file was in the air
        // should not be told the first one is ready.
        if (!stale) setReady(true);
      })
      .catch(() => {
        // A chunk that will not load leaves the button disabled and the
        // reason on screen, which is better than dealing a game with no
        // words in it.
        if (!stale) setReady(false);
      });
    return () => {
      stale = true;
    };
  }, [lang]);

  return ready;
}
