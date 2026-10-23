/**
 * Comparing one language against another.
 *
 * These were written for the test suite and live here instead, because the
 * translator's screen asks exactly the same questions — is this one missing,
 * is it a copy of the English, do the two disagree about what goes in the
 * braces — and a screen cannot import a file that reads the filesystem.
 * `testing/checks/strings.js` re-exports them so the checks read unchanged.
 */

/** Placeholders a string expects, so two languages cannot disagree about them. */
export const placeholdersIn = (text) =>
  new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));

/**
 * How a translation's placeholders may differ from English, and how they may not.
 *
 * A placeholder the caller never passes prints a word in braces to somebody
 * mid-game, so a translation may never invent one. Dropping one is different:
 * German writes its singular without the numeral — "Es fehlt noch einer."
 * rather than "Es fehlt noch 1." — and that is the language being written
 * properly rather than a string being written carelessly. So `count` may go
 * missing from a `_one` form, and nothing else may go missing anywhere.
 */
export function placeholderTrouble(key, english, translated) {
  const wanted = placeholdersIn(english);
  const theirs = placeholdersIn(translated);
  const invented = [...theirs].filter((p) => !wanted.has(p));
  if (invented.length) return `invents ${invented.map((p) => `{${p}}`).join(', ')}`;
  const singular = key.endsWith('_one');
  const dropped = [...wanted].filter((p) => !theirs.has(p) && !(singular && p === 'count'));
  if (dropped.length) return `drops ${dropped.map((p) => `{${p}}`).join(', ')}`;
  return null;
}

/**
 * Is a string being identical to English a sign it was never translated?
 *
 * Only for something that reads as a sentence. Plenty of single words are the
 * same in two languages — German says System, Auto, Blind, Crew, Pause — and
 * flagging those teaches people to ignore the check, which is worse than not
 * having it. A copied sentence is the mistake worth catching.
 */
export function readsAsUntranslated(text) {
  const words = String(text).trim();
  if (!/\s/.test(words)) return false; // one word: nothing to translate
  if (/^[\W\d\s]*$/.test(words)) return false; // numbers and punctuation
  if (/^\{\w+\}[\W\s]*$/.test(words)) return false; // just a placeholder
  return true;
}

/**
 * One key, across every language, with what is wrong with it.
 *
 * `missing` means the reader sees English instead. `copied` means the string
 * is there and is the English one, word for word, in something long enough
 * that it ought not to be. `placeholders` means the two disagree about what
 * goes in the braces, which is the one that reaches a player as literal
 * `{count}` on a card.
 */
export function compareKey(key, tables, { fallback = 'en' } = {}) {
  const english = tables[fallback]?.[key];
  const languages = Object.keys(tables);
  const row = { key, english, by: {}, missing: [], noPlural: [], copied: [], placeholders: [] };
  const plural = /_(one|other|zero|two|few|many)$/.exec(key);
  const stem = plural ? key.slice(0, plural.index) : null;

  for (const lang of languages) {
    const value = tables[lang]?.[key];
    row.by[lang] = value ?? null;
    if (lang === fallback) continue;

    if (value == null || value === '') {
      // A language with no singular is not a language with a hole in it.
      // Thai does not count its nouns, so `_one` simply does not exist — and
      // `resolveKey` knows that, falling back to this language's own `_other`
      // before it ever reaches English. Reporting it as missing would send a
      // translator looking for something there is no way to write.
      if (stem && tables[lang]?.[`${stem}_other`]) row.noPlural.push(lang);
      else row.missing.push(lang);
      continue;
    }
    if (english != null && value === english && readsAsUntranslated(english)) {
      row.copied.push(lang);
    }
    if (english != null) {
      const trouble = placeholderTrouble(key, english, value);
      if (trouble) row.placeholders.push({ lang, trouble });
    }
  }
  return row;
}

/** Every key in any table, compared. Sorted, so two runs read the same. */
export function compareAll(tables, options) {
  const keys = new Set();
  for (const table of Object.values(tables)) for (const key of Object.keys(table ?? {})) keys.add(key);
  return [...keys].sort().map((key) => compareKey(key, tables, options));
}

/** Is there anything on this row worth a translator's attention? */
export const hasTrouble = (row) =>
  row.missing.length > 0 || row.copied.length > 0 || row.placeholders.length > 0;
