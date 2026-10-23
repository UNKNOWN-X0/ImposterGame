/**
 * Where a device keeps the packs written on it.
 *
 * Both play modes need the same shelf: pass-and-play deals from it directly,
 * and a room's host sends what is on it to the server when they open a game.
 * One copy of the reading and writing, so the two cannot drift.
 *
 * Everything read back goes through `validatePack` first. What is in
 * localStorage was written by some earlier version of this app, or by
 * somebody with the developer tools open, and neither is a reason to trust
 * a word list.
 */

import { validatePack, PACK_LIMITS, PACK_VERSION } from '../../content/words/custom.js';

const PACKS_KEY = 'imposter.packs';

/**
 * What the shelf itself looks like on disk.
 *
 * Version 1 was a bare array of packs. Version 2 is `{ v, packs }`, so the
 * shelf can grow a field of its own — an order, a last-opened, whatever turns
 * out to be needed — without every older build reading it as a broken pack
 * list. A bare array is still read, because that is what is on phones today.
 */
const SHELF_VERSION = 2;

/** Whatever is in storage, as a list of packs, whatever vintage it is. */
function unwrap(saved) {
  if (Array.isArray(saved)) return saved; // version 1: the bare array
  if (saved && typeof saved === 'object' && Array.isArray(saved.packs)) return saved.packs;
  return [];
}

export function loadPacks() {
  try {
    const raw = localStorage.getItem(PACKS_KEY);
    return unwrap(raw ? JSON.parse(raw) : [])
      .slice(0, PACK_LIMITS.packs)
      .map((pack) => validatePack(pack))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function savePacks(packs) {
  try {
    localStorage.setItem(
      PACKS_KEY,
      JSON.stringify({ v: SHELF_VERSION, packVersion: PACK_VERSION, packs }),
    );
  } catch {
    /* private browsing, or a phone that has had enough */
  }
}
