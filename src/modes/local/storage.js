/**
 * What this phone remembers between evenings.
 *
 * A table plays again next week with the same people, the same settings and
 * the same wish not to see last week's words. None of that is worth a server,
 * and all of it goes through here so the game itself never touches
 * localStorage — which is also why a private window simply forgets rather
 * than breaking.
 */

import { MAX_PLAYERS, MIN_PLAYERS, PHASE } from '../../core/engine.js';
import { VERSION } from '../../content/history/changelog.js';

/**
 * What each thing is filed under.
 *
 * These live here rather than in the screen that uses them, so that this
 * whole file can be loaded — and therefore tested — without a browser or a
 * JSX transform. While they sat in LocalGame.jsx, importing storage.js meant
 * importing a React component, and `node --test` cannot read one.
 */
export const ROSTER_KEY = 'imposter.roster';
export const RECENT_WORDS_KEY = 'imposter.recentWords';
export const SCORES_KEY = 'imposter.scores';
export const CONFIG_KEY = 'imposter.config';
export const GAME_KEY = 'imposter.game';

/**
 * Recent words survive a reload, so closing the tab and coming back does not
 * hand you the word you just played.
 *
 * Only the words are kept. The fairness counts are keyed by player id, and
 * ids are minted fresh each time the page loads, so storing them would be
 * storing nonsense.
 */
export function loadRecentWords() {
  try {
    const raw = localStorage.getItem(RECENT_WORDS_KEY);
    const words = raw ? JSON.parse(raw) : [];
    return Array.isArray(words) ? words.filter((w) => typeof w === 'string').slice(0, 60) : [];
  } catch {
    return [];
  }
}

export function saveRecentWords(words) {
  try {
    localStorage.setItem(RECENT_WORDS_KEY, JSON.stringify(words.slice(0, 60)));
  } catch {
    /* private browsing — no harm done */
  }
}

/**
 * The settings, so a night survives a reload.
 *
 * Whoever set up the table chose word packs, rule modes, roles and whether
 * anyone is keeping score. Handing all of that back to the defaults because
 * somebody pulled to refresh is its own small betrayal — and it takes the
 * scoreboard with it, since the board only shows when scoring is on.
 *
 * Nothing here is trusted: it goes back through the reducer, which validates
 * every value, so a stale or hand-edited entry cannot deal a broken game.
 */
export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* private browsing — no harm done */
  }
}

/**
 * The night's points, saved by name rather than by id.
 *
 * Player ids are minted fresh every time the page loads, so storing the score
 * against an id would hand everybody a clean slate on a reload. Names are
 * what the table actually uses, they are unique within a game, and they are
 * already what the roster is saved under.
 */
export function loadScores(players) {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    const byName = raw ? JSON.parse(raw) : {};
    const scores = {};
    for (const player of players) {
      const points = Number(byName?.[player.name]);
      if (Number.isInteger(points) && points > 0) scores[player.id] = points;
    }
    return scores;
  } catch {
    return {};
  }
}

export function saveScores(players, scores) {
  try {
    const byName = {};
    for (const player of players) {
      const points = scores[player.id];
      if (points) byName[player.name] = points;
    }
    localStorage.setItem(SCORES_KEY, JSON.stringify(byName));
  } catch {
    /* private browsing — no harm done */
  }
}

/** Remember the group between sessions — it is the same friends most nights. */
export function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    const names = raw ? JSON.parse(raw) : [];
    return Array.isArray(names)
      ? names.filter((n) => typeof n === 'string').slice(0, MAX_PLAYERS)
      : [];
  } catch {
    return [];
  }
}

export function saveRoster(players) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(players.map((p) => p.name)));
  } catch {
    /* private browsing — no harm done */
  }
}

/* ------------------------------------------------------------------ *
 * The game in progress
 * ------------------------------------------------------------------ */

/**
 * The round itself, so a phone that reloads does not end the game.
 *
 * Everything above survives a reload; the round did not. A phone that sleeps
 * too long during the clue phase, or an accidental pull-to-refresh, dropped
 * the table back on the home screen with the cards gone — and at a table the
 * only way out of that is to deal again and pretend the last ten minutes did
 * not happen.
 *
 * Two things are deliberately not stored here. The custom packs, because they
 * are saved separately and can be several thousand words; and nothing at all
 * once the game is over, because next week's table should start clean.
 *
 * The secret word is in here, which is the point — it is the game — but it is
 * worth knowing that it sits in this phone's storage until the game ends.
 * It is the same phone everyone is already passing around.
 */

/** Is this something we can safely hand back to the screens? */
export function isResumable(state) {
  if (!state || typeof state !== 'object') return false;
  // A build that has changed its rules cannot promise to understand a game
  // dealt by the one before it. Dropping it loses a round; restoring it
  // could deal somebody two roles.
  if (state.version !== VERSION) return false;
  if (!Object.values(PHASE).includes(state.phase)) return false;
  // The lobby and the end are not a game in progress; there is nothing to
  // resume and the roster and scores already come back on their own.
  if (state.phase === PHASE.LOBBY || state.phase === PHASE.GAME_OVER) return false;

  const players = state.players;
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    return false;
  }
  if (!players.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string')) {
    return false;
  }

  // Every id mentioned anywhere has to be somebody at this table. A state
  // that votes for a player who is not in it is not a game, it is a crash
  // waiting for the screen that reads it.
  const ids = new Set(players.map((p) => p.id));
  const known = (id) => ids.has(id);
  for (const key of ['order', 'imposterIds', 'eliminated', 'revealed']) {
    const list = state[key];
    // Screens read these arrays directly; missing is invalid, not an empty list.
    if (!Array.isArray(list) || !list.every(known)) return false;
  }
  if (state.roles && Object.keys(state.roles).some((id) => !known(id))) return false;
  if (!Number.isInteger(state.round) || state.round < 0) return false;
  if (!state.config || typeof state.config !== 'object') return false;
  return true;
}

/** The game in progress, or null when there is not one worth coming back to. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!isResumable(saved)) {
      // Anything that does not validate is cleared rather than left to be
      // re-read and re-rejected on every load for the rest of time.
      if (saved) clearGame();
      return null;
    }
    const { version, ...state } = saved;
    return state;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    // The packs are saved on their own and are by far the biggest thing in
    // here; a round is a few hundred bytes without them.
    const { customPacks, ...rest } = state;
    localStorage.setItem(GAME_KEY, JSON.stringify({ ...rest, version: VERSION }));
  } catch {
    /* private browsing, or a storage quota — the game still plays */
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    /* private browsing — no harm done */
  }
}

/**
 * Is there a game on this phone worth coming back to?
 *
 * The home screen asks this before it decides what to show. Without it the
 * round was saved perfectly and never offered back, because the screen that
 * does the offering was not the screen a reload lands on.
 */
export function hasSavedGame() {
  return loadGame() !== null;
}
