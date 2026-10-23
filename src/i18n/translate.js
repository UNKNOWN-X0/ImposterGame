/**
 * Looking a string up: plurals, then placeholders.
 *
 * Plain JavaScript rather than part of index.jsx, because this is the piece
 * with rules in it and rules deserve tests. index.jsx keeps the React around
 * it.
 */

import { STRINGS, FALLBACK_LANG } from './strings/index.js';

/**
 * Which key actually holds the text.
 *
 * A key with a count comes in two forms — `vote.count_one` and
 * `vote.count_other`. Thai declares only `_other`, because Thai does not
 * inflect for number, and German writes its `_one` without the numeral
 * ("Noch ein Mitspieler" rather than "Noch 1 Mitspieler").
 *
 * The language being read decides on its own. An earlier version asked
 * "does `_one` exist in this language OR in English?", which is true for
 * every plural key there is — so Thai resolved to `vote.count_one`, found
 * nothing under it, and fell back to the English sentence. A Thai player saw
 * English every time a count happened to be 1. English is the last resort
 * here, not a tiebreaker between two forms of the same language.
 */
function resolveKey(table, key, params) {
  if (!params || typeof params.count !== 'number') return key;
  const want = params.count === 1 ? 'one' : 'other';

  if (table[`${key}_${want}`]) return `${key}_${want}`;
  if (table[`${key}_other`]) return `${key}_other`;

  const english = STRINGS[FALLBACK_LANG];
  if (english[`${key}_${want}`]) return `${key}_${want}`;
  if (english[`${key}_other`]) return `${key}_other`;
  return key;
}

/**
 * How a number is written, in the language it is being read in.
 *
 * "1000 words" is nobody's idea of a thousand. German groups with a stop and
 * English with a comma, and now that a screen can say three thousand of
 * something, the difference is on screen rather than theoretical. Only actual
 * numbers go through this: a version string is not a number, and neither is
 * a room code.
 */
const numbers = new Map();

function localeNumber(lang, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (!numbers.has(lang)) {
    try {
      numbers.set(lang, new Intl.NumberFormat(lang));
    } catch {
      numbers.set(lang, null); // an engine without this language: plain digits
    }
  }
  const formatter = numbers.get(lang);
  return formatter ? formatter.format(value) : String(value);
}

/** Interpolates {placeholders}; a missing key falls back to English. */
export function translate(lang, key, params) {
  const table = STRINGS[lang] || STRINGS[FALLBACK_LANG];
  const resolved = resolveKey(table, key, params);
  const template = table[resolved] ?? STRINGS[FALLBACK_LANG][resolved] ?? key;

  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    params[name] === undefined ? whole : localeNumber(lang, params[name]),
  );
}
