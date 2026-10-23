/**
 * Where packs come from.
 *
 * Two sources today: the ones we ship, and the ones the table wrote, which
 * arrive as an argument because they live on the device rather than in the
 * bundle. They are listed in the order they should appear, and everything
 * downstream — the settings, the library, the dealing — reads the list rather
 * than either source by name.
 *
 * A third source is a file here and an entry below. It has to answer one
 * question, `packsFor(lang, context)`, and return packs in the shape the rest
 * of the game expects: { id, name, emoji, hint, pairs: [{ word, decoy }] }.
 */

import builtin from './builtin/index.js';

/** Packs written on this device, handed in rather than imported. */
const written = {
  id: 'written',
  packsFor: (lang, { customPacks = [] } = {}) =>
    customPacks.filter((pack) => pack && pack.lang === lang),
};

export const SOURCES = [builtin, written];

/** Every pack for a language, from every source, in order. */
export function packsFrom(lang, context) {
  return SOURCES.flatMap((source) => source.packsFor(lang, context) ?? []);
}
