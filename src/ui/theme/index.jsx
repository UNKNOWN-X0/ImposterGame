/**
 * Appearance: light or dark, and which family of colours.
 *
 * Two separate choices, both per device and both remembered — like the
 * interface language, and unlike the game settings, which belong to whoever
 * is hosting. Your phone being dark does not make anybody else's dark.
 *
 * "System" is the default and means: follow the phone, and keep following it.
 * Someone whose phone turns dark at sunset should watch this turn dark with
 * it, mid-game, without touching anything.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MODES, THEMES, DEFAULT_THEME, DEFAULT_MODE } from './themes.js';

export { MODES, THEMES, DEFAULT_THEME };

const MODE_KEY = 'imposter.mode';
const THEME_KEY = 'imposter.theme';

const ThemeContext = createContext(null);

const read = (key, allowed, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return allowed.includes(saved) ? saved : fallback;
  } catch {
    return fallback; // private browsing
  }
};

/** What the device is asking for right now. */
function systemMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => read(MODE_KEY, MODES, DEFAULT_MODE));
  const [theme, setThemeState] = useState(() =>
    read(THEME_KEY, THEMES.map((t) => t.id), DEFAULT_THEME),
  );
  const [system, setSystem] = useState(systemMode);

  // Keep following the phone for as long as the reader leaves it on system.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystem(query.matches ? 'light' : 'dark');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved = mode === 'system' ? system : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-mode', resolved);
    root.setAttribute('data-theme', theme);
    // The browser's own chrome — the status bar on a phone, the tab strip on
    // a desktop — should match the page rather than sit in last week's colour.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        getComputedStyle(root).getPropertyValue('--bg').trim() || '#120f17',
      );
    }
  }, [resolved, theme]);

  const setMode = useCallback((next) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* private browsing — it just will not be remembered */
    }
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* as above */
    }
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, theme, setMode, setTheme }),
    [mode, resolved, theme, setMode, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme outside ThemeProvider');
  return value;
}
