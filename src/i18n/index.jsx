/**
 * Interface language.
 *
 * This is a per-device choice and deliberately separate from the language the
 * secret words come from: at one table a German speaker and a Thai speaker can
 * each read the buttons in their own language while playing the same round.
 * The word language belongs to the game (see src/game/words) and is set by
 * whoever is hosting.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, FALLBACK_LANG, loadStrings, stringsReady } from './strings/index.js';
import { translate } from './translate.js';
import { describe } from '../features/errors/log.js';

export { LANGUAGES, FALLBACK_LANG };

const STORAGE_KEY = 'imposter.lang';
const LanguageContext = createContext(null);

const supported = (id) => LANGUAGES.some((l) => l.id === id);

/** Saved choice first, then the browser's preference, then English. */
export function detectLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported(saved)) return saved;
  } catch {
    /* private browsing */
  }
  const candidates =
    typeof navigator === 'undefined'
      ? []
      : [navigator.language, ...(navigator.languages || [])].filter(Boolean);
  for (const tag of candidates) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (supported(base)) return base;
  }
  return FALLBACK_LANG;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);
  // Bumped when a language finishes arriving. `translate` reads a table that
  // is filled in place, so React has no way of knowing it changed — this is
  // what tells the tree to draw itself again in the new language.
  const [arrived, setArrived] = useState(0);

  useEffect(() => {
    if (stringsReady(lang)) return undefined;
    let stale = false;
    loadStrings(lang).then(() => {
      // Somebody who changed their mind twice while a file was in the air
      // should not be dragged back to the language they left.
      if (!stale) setArrived((n) => n + 1);
    });
    return () => {
      stale = true;
    };
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    // A crash report should say which language the reader was reading, and
    // the DOM cannot be trusted for it: an error during the first render
    // happens before this effect has ever run.
    describe({ lang });
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!supported(next)) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing */
    }
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
    }),
    // `arrived` is not read in here and that is deliberate: it is in the list
    // so that a language turning up rebuilds this object and redraws the
    // screens, which otherwise have no way to notice.
    [lang, setLang, arrived],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used inside <LanguageProvider>');
  return ctx;
}

/**
 * Translates an error thrown by the rules engine or returned by the server.
 * They travel as codes rather than sentences so every player sees the reason
 * in their own language.
 */
export function useErrorText() {
  const { t } = useT();
  return useCallback(
    (err) => {
      if (!err) return '';
      const code = typeof err === 'string' ? err : err.code || err.message;
      const params = typeof err === 'object' ? err.params : undefined;
      const key = `errors.${code}`;
      const text = t(key, params);
      return text === key ? t('errors.unknown') : text;
    },
    [t],
  );
}
