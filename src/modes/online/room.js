/**
 * Talking to the party server — the part with no React in it.
 *
 * State arrives over an EventSource (Server-Sent Events) and actions go back
 * over plain POSTs. The browser reconnects a dropped EventSource by itself,
 * which is exactly what you want when someone's phone locks mid-game.
 *
 * This lives apart from the hook that uses it because it is the hardest code
 * in the project — reconnects, stale tokens, a room that has been swept away
 * while a phone was asleep — and because for a long time none of it was
 * tested, on the grounds that testing a React hook needs a renderer. None of
 * what follows needs one: every door to the outside (fetch, EventSource,
 * localStorage) is a parameter with the real thing as its default, so a test
 * can hand it a fake and watch what happens. See room.test.js.
 */

const SESSION_KEY = 'imposter.session';
export { SESSION_KEY };

/** The phone's own storage, or nothing at all under `node --test`. */
const store = () => globalThis.localStorage;

export function loadSession(storage = store()) {
  try {
    const raw = storage.getItem(SESSION_KEY);
    const s = raw ? JSON.parse(raw) : null;
    // Half a session is no session: without both, every call would 401.
    return s && s.code && s.token ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session, storage = store()) {
  try {
    if (session) storage.setItem(SESSION_KEY, JSON.stringify(session));
    else storage.removeItem(SESSION_KEY);
  } catch {
    /* private browsing */
  }
}

export function clearSession(storage = store()) {
  saveSession(null, storage);
}

/**
 * Errors come back as codes, not sentences, so each phone can render the
 * reason in whatever language its owner is reading.
 */
export class ApiError extends Error {
  constructor(code, params) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

export async function api(path, options, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(path, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
  } catch {
    // The server is not there, or the wifi went. Either way it is not a
    // sentence anybody wants to read, so it gets a code like the rest.
    throw new ApiError('network');
  }
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(body.error || 'unknown', body.params);
  return body;
}

/**
 * What this server is, or null when there is not one.
 *
 * The built site is just static files, so it can be hosted anywhere — but on
 * a static host (GitHub Pages and friends) there is no room server behind it
 * and phone-to-phone play cannot work. Better to say so plainly than to let a
 * button fail with a 404.
 *
 * Carries the length of the codes it hands out, because a deployment on the
 * open internet may be using longer ones and the join box has to accept what
 * it is given.
 */
export async function serverInfo(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl('/api/health', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json();
    if (body.ok !== true) return null;
    return { codeLength: Number(body.codeLength) || 4, minPlayers: body.minPlayers };
  } catch {
    return null;
  }
}

export async function serverIsRunning(fetchImpl = globalThis.fetch) {
  return (await serverInfo(fetchImpl)) !== null;
}

export async function createRoom(name, { fetchImpl, storage, wordLang } = {}) {
  const session = await api(
    '/api/rooms',
    { method: 'POST', body: JSON.stringify({ name, wordLang }) },
    fetchImpl ?? globalThis.fetch,
  );
  saveSession(session, storage ?? store());
  return session;
}

export async function joinRoom(code, name, { fetchImpl, storage } = {}) {
  // Codes are read off a screen and typed in by somebody at a party, so a
  // stray space or a lowercase letter is not a mistake worth refusing.
  const clean = String(code || '').trim().toUpperCase();
  const session = await api(
    `/api/rooms/${clean}/join`,
    { method: 'POST', body: JSON.stringify({ name }) },
    fetchImpl ?? globalThis.fetch,
  );
  saveSession(session, storage ?? store());
  return session;
}

/**
 * Tell the room this phone is done, then forget the session.
 *
 * Saying so matters: the server cannot tell a phone that has left from one
 * whose screen locked or whose owner walked out of range, so without this
 * call a host who tapped Leave simply went quiet — and since the crown was
 * only ever handed out when the room was empty, it stayed with a player who
 * was no longer there and every host-only action was refused for good.
 *
 * It never throws. The session is cleared either way: a phone that has
 * decided to leave has left, whether or not the server was reachable to hear
 * it, and the sweeper will tidy the rest.
 */
export async function leaveRoom(session, { fetchImpl, storage } = {}) {
  try {
    if (session?.code && session?.token) {
      await api(
        `/api/rooms/${session.code}/leave`,
        { method: 'POST', body: JSON.stringify({ token: session.token }) },
        fetchImpl ?? globalThis.fetch,
      );
    }
  } catch {
    /* the room may be gone, asleep, or on the other side of a dropped wifi */
  }
  clearSession(storage ?? store());
}

/** Where this phone listens for the room. */
export function streamUrl(session) {
  return `/api/rooms/${session.code}/stream?token=${encodeURIComponent(session.token)}`;
}

export async function sendAction(session, action, fetchImpl = globalThis.fetch) {
  return api(
    `/api/rooms/${session.code}/action`,
    { method: 'POST', body: JSON.stringify({ token: session.token, action }) },
    fetchImpl,
  );
}

/**
 * Listen to a room.
 *
 * `onStatus` is told one of three things, and the distinction is the whole
 * point of it: `connecting` is a phone that has not got there yet, `live` is
 * a phone that has, and `lost` is a phone that had and no longer does. Only
 * the third is worth putting on the screen, because only the third means
 * something the player can see has gone stale.
 *
 * Returns the handle to close it with. EventSource retries on its own, so
 * nothing here needs to.
 */
export function connect(session, { onPayload, onStatus }, EventSourceImpl = globalThis.EventSource) {
  const source = new EventSourceImpl(streamUrl(session));
  let connectedOnce = false;

  source.onopen = () => {
    connectedOnce = true;
    onStatus?.('live');
  };

  source.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      // A malformed frame is one bad frame, not a reason to drop a room.
      return;
    }
    connectedOnce = true;
    onPayload?.(payload);
    onStatus?.('live');
  };

  source.onerror = () => {
    // Once a stream has worked, keep showing the dropped state through
    // repeated automatic retries so the player can choose a manual retry.
    onStatus?.(connectedOnce ? 'lost' : 'connecting');
  };

  return {
    source,
    close() {
      source.close();
    },
  };
}
