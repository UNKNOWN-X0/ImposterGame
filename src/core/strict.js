/**
 * Strict mode: the rules holding themselves to their own promise.
 *
 * The engine's first claim about itself is that it is pure — `reduce` returns
 * a new state and never changes the one it was given. Nothing enforced that.
 * A single `state.players.push(…)` or `state.votes[id] = …` would work, and
 * would look like it worked, right up until a screen somewhere rendered a
 * round that the reducer had never agreed to: React compares states by
 * identity, so a state changed in place is a state that React is certain has
 * not changed at all. The bug then appears three screens later, in a
 * component that did nothing wrong.
 *
 * So in development every state the engine hands out is frozen. The mutation
 * throws where it is written, with a stack that names the line, instead of
 * becoming a wrong card half a minute later.
 *
 * It is off in production, where it would be a cost with no reader: freezing
 * is work, and by then the mutation either exists and was caught in testing
 * or does not exist at all. The one case worth the cost — a party server,
 * which hands the same state to eight phones — is covered by the cache in
 * select.js freezing what it shares.
 */

/**
 * Is this a place where a mistake should be loud?
 *
 *  - `node --test` sets NODE_TEST_CONTEXT, so the suite runs strict.
 *  - Vite's dev server sets import.meta.env.DEV, so `npm run dev` does too.
 *  - IMPOSTER_STRICT=1 or =0 overrides either way, for when you want to run
 *    the server strict for an afternoon to see if anything shouts.
 *  - Everything else — a built site, `npm start` — is off.
 */
function detect() {
  if (typeof process !== 'undefined' && process?.env) {
    if (process.env.IMPOSTER_STRICT === '1') return true;
    if (process.env.IMPOSTER_STRICT === '0') return false;
    if (process.env.NODE_TEST_CONTEXT) return true;
    if (process.env.NODE_ENV === 'development') return true;
  }
  try {
    // Vite replaces this in a build; in plain Node there is no `env` on
    // import.meta at all, which the `?.` handles rather than throwing.
    if (import.meta.env?.DEV === true) return true;
  } catch {
    /* not running under a bundler */
  }
  return false;
}

let strict = detect();

/** Is the engine currently checking itself? */
export const isStrict = () => strict;

/**
 * Turn it on or off by hand. Returns the previous setting, so a test can put
 * it back where it found it.
 */
export function setStrict(on) {
  const was = strict;
  strict = Boolean(on);
  return was;
}

/**
 * Freeze a state and everything in it.
 *
 * Deep, because the shallow version is a trap: `Object.freeze(state)` leaves
 * `state.votes[id] = 'x'` and `state.players.push(…)` working perfectly, and
 * those are the two mutations anybody would actually write.
 *
 * Cycles cannot happen in a state — it is the shape of its own JSON — but a
 * `seen` set costs nothing and means this cannot be the thing that hangs.
 */
export function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

/** Freeze it if we are being strict, and hand it straight back if not. */
export const guard = (value) => (strict ? deepFreeze(value) : value);
