/**
 * A cheap cap on how often one caller may do something.
 *
 * None of this is security — anybody on the same wifi is already trusted with
 * the game, and anybody who is not cannot reach a LAN server at all. It
 * matters for the other deployment: the same build runs on a public URL,
 * where `POST /api/rooms` is an open endpoint that mints a room and keeps it
 * in memory for six hours. One bored person with a loop fills the room table
 * and every real code collides with something.
 *
 * So: a sliding window per caller, in a Map, with no dependencies and no
 * configuration anybody has to understand. The window is the last minute (or
 * ten), the count is how many times, and that is the whole idea.
 */

/** Windows, counts and limits for one kind of request. */
export class Limit {
  /**
   * @param {string} name     what is being limited, for the message
   * @param {number} max      how many are allowed in the window
   * @param {number} windowMs how long the window is
   */
  constructor(name, max, windowMs) {
    this.name = name;
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map(); // key -> number[] of timestamps
  }

  /**
   * Record one attempt. Returns null when it is allowed, or how many
   * milliseconds until it would be, when it is not.
   */
  check(key, now = Date.now()) {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);

    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return Math.max(1, recent[0] + this.windowMs - now);
    }

    recent.push(now);
    this.hits.set(key, recent);
    return null;
  }

  /**
   * Forget callers who have gone quiet.
   *
   * Without this the Map is a slow memory leak keyed by every address that
   * ever touched the server — which is the same shape of problem the limit
   * exists to prevent.
   */
  sweep(now = Date.now()) {
    const since = now - this.windowMs;
    for (const [key, times] of this.hits) {
      const recent = times.filter((t) => t > since);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }

  /** For tests. */
  reset() {
    this.hits.clear();
  }
}

/**
 * The limits themselves.
 *
 * Generous on purpose: every one of these is far above what a party does and
 * far below what a script does. A table of eight tapping through a fast round
 * might send an action every couple of seconds each; 240 a minute per phone
 * leaves room for all of it and for a double tap on every button.
 */
export const LIMITS = {
  // Opening rooms is the expensive one: each is a code out of a small
  // alphabet and six hours of memory.
  createRoom: new Limit('createRoom', Number(process.env.LIMIT_CREATE) || 15, 10 * 60 * 1000),
  // Joining is cheaper but still writes to a room; a wrong code should not
  // be worth grinding through.
  joinRoom: new Limit('joinRoom', Number(process.env.LIMIT_JOIN) || 60, 10 * 60 * 1000),
  // Actions are per token, not per address: everybody at a table shares one
  // wifi and would otherwise share one budget.
  action: new Limit('action', Number(process.env.LIMIT_ACTION) || 240, 60 * 1000),
};

/** Tidy every limit at once; called by the same sweeper that drops old rooms. */
export function sweepLimits(now = Date.now()) {
  for (const limit of Object.values(LIMITS)) limit.sweep(now);
}

/**
 * Forget every caller — for tests.
 *
 * The limits are module state, so a suite that opens a room per test shares
 * one allowance across all of them: at fifteen rooms per ten minutes the
 * sixteenth test got a 429 and failed somewhere else entirely, looking like
 * a bug in whatever it was actually checking. A test starts from nothing.
 */
export function _resetLimits() {
  for (const limit of Object.values(LIMITS)) limit.reset();
}

/**
 * Who is asking.
 *
 * Behind a proxy (a public deployment) the socket address is the proxy's, so
 * the first entry of x-forwarded-for is the caller. That header is trivially
 * spoofed, which would matter if this were an access control — it is not. It
 * is a cap on accidental and casual load, and for the one case that actually
 * needs to be stopped, a loop on somebody's laptop, it is exactly right.
 */
export function callerOf(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || 'unknown';
}
