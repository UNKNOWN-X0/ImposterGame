/**
 * The room client: reconnects, stale tokens, and rooms that are no longer
 * there.
 *
 * This is the hardest code in the project and for a long time it had no tests
 * at all, because the reasoning went: it is a React hook, testing it needs a
 * renderer, and the project has no renderer. The reasoning was wrong about
 * the first part. Almost none of this is React — it is a stream, some POSTs
 * and a token — and all of it has been moved into room.js, where a fake
 * EventSource and a fake fetch are enough.
 *
 * The failure mode these are about is not an exception in a log. It is six
 * people in a room looking at a phone that will not come back.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import {
  ApiError,
  SESSION_KEY,
  api,
  clearSession,
  connect,
  createRoom,
  joinRoom,
  leaveRoom,
  loadSession,
  saveSession,
  sendAction,
  serverInfo,
  serverIsRunning,
  streamUrl,
} from './room.js';

/* ------------------------------------------------------------------ *
 * Fakes: a phone's storage, a server, and a stream that can be cut
 * ------------------------------------------------------------------ */

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    raw: map,
  };
};

/** A fetch that answers however the test says, and records what it was asked. */
function fakeFetch(answer) {
  const calls = [];
  const fn = async (path, options) => {
    calls.push({ path, options });
    const reply = typeof answer === 'function' ? answer(path, options) : answer;
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.ok ?? true,
      status: reply.status ?? 200,
      json: async () => {
        if (reply.body === undefined) throw new Error('no body');
        return reply.body;
      },
    };
  };
  fn.calls = calls;
  return fn;
}

/**
 * An EventSource that does nothing until a test tells it to — open, deliver a
 * frame, drop. The real one is a browser reconnecting on its own; what
 * matters here is what this code makes of each event.
 */
class FakeEventSource {
  static last = null;

  constructor(url) {
    this.url = url;
    this.closed = false;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    FakeEventSource.last = this;
  }

  open() {
    this.onopen?.();
  }

  send(data) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }

  drop() {
    this.onerror?.(new Error('dropped'));
  }

  close() {
    this.closed = true;
  }
}

/** Open a room on a fake stream and collect everything it says. */
function listen(session = { code: 'ABCD', token: 'tok' }) {
  const payloads = [];
  const statuses = [];
  const room = connect(
    session,
    { onPayload: (p) => payloads.push(p), onStatus: (s) => statuses.push(s) },
    FakeEventSource,
  );
  return { room, payloads, statuses, source: FakeEventSource.last };
}

/* ------------------------------------------------------------------ *
 * The stream
 * ------------------------------------------------------------------ */

test('the stream is opened on this room, with this token', () => {
  const { source } = listen({ code: 'WXYZ', token: 'a token/with slashes' });
  assert.equal(source.url, '/api/rooms/WXYZ/stream?token=a%20token%2Fwith%20slashes');
  assert.equal(streamUrl({ code: 'WXYZ', token: 'x' }), '/api/rooms/WXYZ/stream?token=x');
});

test('a room that opens and sends state goes live', () => {
  const { source, payloads, statuses } = listen();
  source.open();
  source.send({ code: 'ABCD', state: { phase: 'lobby' } });
  assert.deepEqual(statuses, ['live', 'live']);
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].state.phase, 'lobby');
});

test('a drop after being live is reported as lost', () => {
  // This is the one the player sees: a banner saying the room went quiet.
  const { source, statuses } = listen();
  source.open();
  source.drop();
  assert.deepEqual(statuses, ['live', 'lost']);
});

test('a second drop keeps a previously connected room marked as lost', () => {
  const { source, statuses } = listen();
  source.open();
  source.drop();
  source.drop();
  assert.deepEqual(statuses, ['live', 'lost', 'lost']);
});

test('a drop before ever arriving is still just connecting', () => {
  // A phone that has not got there yet has nothing to say it lost.
  const { source, statuses } = listen();
  source.drop();
  assert.deepEqual(statuses, ['connecting']);
});

test('a phone that comes back goes live again, and can be lost again', () => {
  // The whole point of the retry: somebody picks their phone up and the game
  // is there. Then they put it down again.
  const { source, statuses, payloads } = listen();
  source.open();
  source.drop();
  source.open();
  source.send({ state: { phase: 'vote' } });
  source.drop();
  assert.deepEqual(statuses, ['live', 'lost', 'live', 'live', 'lost']);
  assert.equal(payloads.at(-1).state.phase, 'vote');
});

test('a malformed frame is ignored rather than killing the room', () => {
  const { source, payloads, statuses } = listen();
  source.open();
  source.send('{not json');
  source.send({ state: { phase: 'clues' } });
  assert.equal(payloads.length, 1, 'only the good frame got through');
  assert.deepEqual(statuses, ['live', 'live'], 'the bad one said nothing at all');
  assert.equal(source.closed, false, 'and the stream stayed open');
});

test('closing the room closes the stream', () => {
  const { room, source } = listen();
  source.open();
  room.close();
  assert.equal(source.closed, true);
});

test('a frame arriving before the open event still counts as live', () => {
  // Which is what happens when the first thing a phone receives is the room.
  const { source, statuses } = listen();
  source.send({ state: { phase: 'lobby' } });
  assert.deepEqual(statuses, ['live']);
  source.drop();
  assert.deepEqual(statuses, ['live', 'lost']);
});

/* ------------------------------------------------------------------ *
 * Actions, and the ways they are refused
 * ------------------------------------------------------------------ */

const session = { code: 'ABCD', token: 'tok' };

test('an action is posted to this room with this token', async () => {
  const fetchImpl = fakeFetch({ body: { ok: true } });
  await sendAction(session, { type: 'CONTINUE' }, fetchImpl);
  const [call] = fetchImpl.calls;
  assert.equal(call.path, '/api/rooms/ABCD/action');
  assert.equal(call.options.method, 'POST');
  assert.deepEqual(JSON.parse(call.options.body), {
    token: 'tok',
    action: { type: 'CONTINUE' },
  });
});

test('a stale token comes back as a code, not a sentence', async () => {
  // A phone that was in this room yesterday, or one the host kicked.
  const fetchImpl = fakeFetch({ ok: false, status: 401, body: { error: 'staleToken' } });
  await assert.rejects(() => sendAction(session, { type: 'CONTINUE' }, fetchImpl), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, 'staleToken');
    return true;
  });
});

test('a room that has been swept away says so', async () => {
  // Rooms are swept ten minutes after everyone leaves; a phone asleep in a
  // pocket wakes up to this.
  const fetchImpl = fakeFetch({ ok: false, status: 404, body: { error: 'noSuchRoom' } });
  await assert.rejects(
    () => sendAction(session, { type: 'CONTINUE' }, fetchImpl),
    (err) => err.code === 'noSuchRoom',
  );
});

test('a refusal from the rules carries what it needs to be read out', async () => {
  const fetchImpl = fakeFetch({
    ok: false,
    status: 400,
    body: { error: 'needMorePlayers', params: { count: 2 } },
  });
  await assert.rejects(
    () => sendAction(session, { type: 'START_GAME' }, fetchImpl),
    (err) => err.code === 'needMorePlayers' && err.params.count === 2,
  );
});

test('no wifi is a code too', async () => {
  const fetchImpl = fakeFetch(new TypeError('Failed to fetch'));
  await assert.rejects(
    () => api('/api/rooms/ABCD/action', { method: 'POST' }, fetchImpl),
    (err) => err.code === 'network',
  );
});

test('an error with no body at all still has a code', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 500 });
  await assert.rejects(
    () => api('/api/anything', {}, fetchImpl),
    (err) => err.code === 'unknown',
  );
});

/* ------------------------------------------------------------------ *
 * Getting into a room
 * ------------------------------------------------------------------ */

test('a code typed at a party is cleaned up before it is sent', async () => {
  const fetchImpl = fakeFetch({ body: { code: 'ABCD', token: 'tok' } });
  const storage = fakeStorage();
  await joinRoom('  abcd  ', 'Ann', { fetchImpl, storage });
  assert.equal(fetchImpl.calls[0].path, '/api/rooms/ABCD/join');
});

test('joining remembers the session, so a reload walks back in', async () => {
  const fetchImpl = fakeFetch({ body: { code: 'ABCD', token: 'tok' } });
  const storage = fakeStorage();
  await joinRoom('ABCD', 'Ann', { fetchImpl, storage });
  assert.deepEqual(loadSession(storage), { code: 'ABCD', token: 'tok' });
});

test('opening a room remembers it the same way', async () => {
  const fetchImpl = fakeFetch({ body: { code: 'WXYZ', token: 'hosttok' } });
  const storage = fakeStorage();
  const made = await createRoom('Ann', { fetchImpl, storage });
  assert.equal(made.code, 'WXYZ');
  assert.equal(loadSession(storage).token, 'hosttok');
});

test('a refused join leaves no session behind', async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 404, body: { error: 'noSuchRoom' } });
  const storage = fakeStorage();
  await assert.rejects(() => joinRoom('ZZZZ', 'Ann', { fetchImpl, storage }));
  assert.equal(loadSession(storage), null, 'nothing to walk back into');
});

test('half a session is no session', () => {
  for (const junk of [
    '{"code":"ABCD"}',
    '{"token":"tok"}',
    'not json',
    'null',
    '{}',
  ]) {
    assert.equal(loadSession(fakeStorage({ [SESSION_KEY]: junk })), null, junk);
  }
});

test('leaving forgets the room', () => {
  const storage = fakeStorage();
  saveSession({ code: 'ABCD', token: 'tok' }, storage);
  clearSession(storage);
  assert.equal(loadSession(storage), null);
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test('a private window simply does not remember', () => {
  const locked = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    },
  };
  assert.equal(loadSession(locked), null);
  assert.doesNotThrow(() => saveSession({ code: 'ABCD', token: 'tok' }, locked));
  assert.doesNotThrow(() => clearSession(locked));
});

/* ------------------------------------------------------------------ *
 * Is there a server at all?
 * ------------------------------------------------------------------ */

test('a static host, with no room server behind it, is recognised', async () => {
  // GitHub Pages and friends serve the game perfectly well and have no rooms.
  assert.equal(await serverInfo(fakeFetch({ ok: false, status: 404 })), null);
  assert.equal(await serverInfo(fakeFetch(new TypeError('Failed to fetch'))), null);
  assert.equal(await serverInfo(fakeFetch({ body: { ok: false } })), null);
  assert.equal(await serverIsRunning(fakeFetch({ ok: false, status: 404 })), false);
});

test('a real server says how long its codes are', async () => {
  const info = await serverInfo(fakeFetch({ body: { ok: true, codeLength: 6, minPlayers: 3 } }));
  assert.deepEqual(info, { codeLength: 6, minPlayers: 3 });
});

test('a server that does not say falls back to four', async () => {
  const info = await serverInfo(fakeFetch({ body: { ok: true } }));
  assert.equal(info.codeLength, 4);
});

test('health is asked for fresh, never from the cache', async () => {
  // A cached "yes" from before the server went down is worse than no answer.
  const fetchImpl = fakeFetch({ body: { ok: true } });
  await serverInfo(fetchImpl);
  assert.equal(fetchImpl.calls[0].options.cache, 'no-store');
});


/* ------------------------------------------------------------------ *
 * Leaving on purpose
 * ------------------------------------------------------------------ */

test('leaving tells the room, then forgets the session', async () => {
  const storage = fakeStorage();
  const session = { code: 'AB12', token: 'tok', playerId: 'p1' };
  saveSession(session, storage);
  const fetchImpl = fakeFetch({ body: { ok: true } });

  await leaveRoom(session, { fetchImpl, storage });

  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].path, '/api/rooms/AB12/leave');
  assert.equal(fetchImpl.calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(fetchImpl.calls[0].options.body), { token: 'tok' });
  assert.equal(loadSession(storage), null);
});

test('leaving still leaves, even when the room cannot be reached', async () => {
  // The phone has decided. A dropped wifi, a swept room or a server that has
  // gone home does not get to keep somebody in a room they have left — and
  // the sweeper tidies the other side in its own time.
  const storage = fakeStorage();
  const session = { code: 'AB12', token: 'tok' };
  saveSession(session, storage);

  await leaveRoom(session, { fetchImpl: fakeFetch(new Error('network down')), storage });
  assert.equal(loadSession(storage), null);
});

test('leaving with no session asks the server nothing', async () => {
  const fetchImpl = fakeFetch({ body: { ok: true } });
  await leaveRoom(null, { fetchImpl, storage: fakeStorage() });
  assert.equal(fetchImpl.calls.length, 0);
});
