/**
 * Randomness you can replay.
 *
 * Every shuffle and every pick in the game comes through here, seeded, so a
 * game can be replayed exactly — which is what makes the rules testable and
 * what lets a room and a phone agree about what happened.
 */

/* ------------------------------------------------------------------ *
 * Randomness: seeded so tests (and replays) are reproducible.
 * ------------------------------------------------------------------ */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
