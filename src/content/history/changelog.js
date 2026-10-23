/**
 * What changed, in the game rather than in the repository.
 *
 * CHANGELOG.md is written for whoever works on this: it says which file moved
 * and why a token was renamed. This is the same history written for whoever
 * plays it, in the three languages the game speaks — a release is a line or
 * three about what is different at the table, and nothing about the code.
 *
 * Each note is a key, and the string lives in src/i18n/strings/ beside every
 * other sentence in the app: `log.<version>.<note>`. A note with no English
 * string is a bug, and there is a test that says so.
 *
 * Newest first. The top entry is the version the app is, and package.json has
 * to agree with it — also a test.
 */

export const RELEASES = [
  {
    v: '1.29.0',
    date: '2026-10-21',
    notes: ['setup', 'roles', 'retry'],
  },
  {
    v: '1.28.0',
    date: '2026-10-20',
    notes: ['secret', 'fairDeal', 'hostLeft'],
  },
  {
    v: '1.27.0',
    date: '2026-10-20',
    notes: ['presets', 'stillness'],
  },
  {
    v: '1.26.0',
    date: '2026-10-19',
    notes: ['accents', 'packWarnings'],
  },
  {
    v: '1.25.0',
    date: '2026-10-19',
    notes: ['lighter'],
  },
  {
    v: '1.24.0',
    date: '2026-10-19',
    notes: ['restart'],
  },
  {
    v: '1.23.1',
    date: '2026-10-17',
    notes: ['tidyScores'],
  },
  {
    v: '1.23.0',
    date: '2026-10-17',
    notes: ['resume'],
  },
  {
    v: '1.22.0',
    date: '2026-10-07',
    notes: ['icon', 'standalone'],
  },
  {
    v: '1.21.3',
    date: '2026-09-29',
    notes: ['endings'],
  },
  {
    v: '1.21.2',
    date: '2026-09-29',
    notes: ['gameOver'],
  },
  {
    v: '1.21.1',
    date: '2026-09-29',
    notes: ['verdict'],
  },
  {
    v: '1.21.0',
    date: '2026-09-29',
    notes: ['crash', 'quiet', 'noWord'],
  },
  {
    v: '1.20.1',
    date: '2026-09-28',
    notes: ['build'],
  },
  {
    v: '1.20.0',
    date: '2026-09-28',
    notes: ['tidy', 'roles'],
  },
  {
    v: '1.19.0',
    date: '2026-09-28',
    notes: ['library', 'browse', 'whatsNew'],
  },
  {
    v: '1.18.0',
    date: '2026-09-28',
    notes: ['packs', 'miss', 'share'],
  },
  {
    v: '1.17.0',
    date: '2026-09-27',
    notes: ['rules', 'picker', 'tips'],
  },
  {
    v: '1.16.0',
    date: '2026-09-27',
    notes: ['values', 'sweep'],
  },
  {
    v: '1.15.0',
    date: '2026-09-27',
    notes: ['roles', 'scores', 'leak'],
  },
  {
    v: '1.14.0',
    date: '2026-09-27',
    notes: ['hosting'],
  },
  {
    v: '1.13.1',
    date: '2026-09-27',
    notes: ['launcher'],
  },
  {
    v: '1.13.0',
    date: '2026-09-27',
    notes: ['modes', 'themes'],
  },
  {
    v: '1.12.1',
    date: '2026-09-26',
    notes: ['thaiOne', 'contrast'],
  },
  {
    v: '1.12.0',
    date: '2026-09-26',
    notes: ['packChip'],
  },
  {
    v: '1.11.0',
    date: '2026-09-26',
    notes: ['icons'],
  },
  {
    v: '1.10.1',
    date: '2026-09-26',
    notes: ['hand'],
  },
  {
    v: '1.10.0',
    date: '2026-09-26',
    notes: ['motion'],
  },
  {
    v: '1.9.0',
    date: '2026-09-26',
    notes: ['pills', 'roster'],
  },
  {
    v: '1.8.0',
    date: '2026-09-26',
    notes: ['drawn'],
  },
  {
    v: '1.7.0',
    date: '2026-09-26',
    notes: ['fair'],
  },
  {
    v: '1.6.0',
    date: '2026-09-25',
    notes: ['words'],
  },
  {
    v: '1.5.1',
    date: '2026-09-25',
    notes: ['language'],
  },
  {
    v: '1.5.0',
    date: '2026-09-25',
    notes: ['rounds', 'clueGrid'],
  },
  {
    v: '1.4.0',
    date: '2026-09-25',
    notes: ['hint'],
  },
  {
    v: '1.3.0',
    date: '2026-09-25',
    notes: ['blind'],
  },
  {
    v: '1.2.0',
    date: '2026-09-25',
    notes: ['decoys', 'call'],
  },
  {
    v: '1.1.0',
    date: '2026-09-25',
    notes: ['languages', 'hold'],
  },
  {
    v: '1.0.0',
    date: '2026-09-25',
    notes: ['first'],
  },
];

/** What the app currently is. */
export const VERSION = RELEASES[0].v;

/** The key the string for one note lives under. */
export const noteKey = (version, note) => `log.${version}.${note}`;

/**
 * Whether there is anything to read since the player last looked.
 *
 * Never true on a first visit: somebody opening the game for the first time
 * has not missed anything, and a badge that is on for everybody is decoration
 * rather than news.
 */
export function hasNews(seen) {
  if (!seen) return false;
  return seen !== VERSION;
}

/** The releases a player has not seen yet, newest first. */
export function since(seen) {
  if (!seen) return [];
  const at = RELEASES.findIndex((r) => r.v === seen);
  return at < 0 ? RELEASES : RELEASES.slice(0, at);
}
