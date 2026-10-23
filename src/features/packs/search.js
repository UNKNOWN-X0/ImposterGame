/**
 * Looking for a word across every pack.
 *
 * Out of the screen so it can be tested: what a search matches is a rule,
 * and the rule is not obvious. It looks at the near miss as well as the word,
 * because "is Sashimi in here?" is a fair question and the answer is yes,
 * as the thing the imposter gets when Sushi comes up.
 *
 * Matching is case-insensitive and by substring rather than by whole word:
 * somebody typing "fried" wants Fried rice, and somebody typing "ข้าว" wants
 * every rice dish there is. It does not normalise anything beyond case —
 * Thai marks are part of the word, and stripping them was a bug once.
 */

/**
 * The pairs in one pack that match, or all of them when nothing is typed.
 *
 * Each of these lowers its own query rather than trusting the caller to have
 * done it: a search that quietly finds nothing because somebody passed the
 * raw text of an input is the kind of bug that never looks like a bug.
 */
export function filterPack(pack, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return pack.pairs;
  return pack.pairs.filter(
    (pair) => pair.word.toLowerCase().includes(q) || (pair.decoy ?? '').toLowerCase().includes(q),
  );
}

/**
 * The shelf as it should be read: the table's own packs first, then ours,
 * and — while something is being searched for — only the packs that have
 * anything to show.
 */
export function shelfFor(packs, query) {
  const q = (query ?? '').trim().toLowerCase();
  return [...packs]
    .sort((a, b) => Number(Boolean(b.custom)) - Number(Boolean(a.custom)))
    .map((pack) => ({ pack, pairs: filterPack(pack, q) }))
    .filter(({ pairs }) => !q || pairs.length > 0);
}

/** Where a match starts in a word, for marking it. -1 when it does not. */
export function matchAt(text, query) {
  const q = (query ?? '').trim().toLowerCase();
  return q ? text.toLowerCase().indexOf(q) : -1;
}
