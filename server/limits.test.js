/**
 * The caps, and the party they must not get in the way of.
 *
 * Both halves matter. A limit that does not stop a loop is decoration; a
 * limit that stops a table of eight playing a fast round is a bug that only
 * shows up at a party, which is the worst place to find one. So these test
 * the refusal and then play a whole noisy game through the real server to be
 * sure nobody is ever told to slow down for playing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Limit, LIMITS, callerOf, sweepLimits } from './limits.js';
import { createServer } from './server.js';
import { _resetRooms } from './rooms.js';
import '../src/testing/ready.js';

/* ------------------------------------------------------------------ *
 * The window itself
 * ------------------------------------------------------------------ */

test('the first few are allowed and the next are not', () => {
  const limit = new Limit('t', 3, 1000);
  const at = 10_000;
  assert.equal(limit.check('ip', at), null);
  assert.equal(limit.check('ip', at + 1), null);
  assert.equal(limit.check('ip', at + 2), null);
  assert.ok(limit.check('ip', at + 3) > 0, 'the fourth is refused');
});

test('it says how long to wait, and it is true', () => {
  const limit = new Limit('t', 2, 1000);
  const at = 10_000;
  limit.check('ip', at);
  limit.check('ip', at + 100);
  const wait = limit.check('ip', at + 200);
  assert.equal(wait, 800, 'the oldest hit falls out of the window in 800ms');
  assert.equal(limit.check('ip', at + 200 + wait), null, 'and then it is allowed');
});

test('the window slides rather than resetting on a tick', () => {
  const limit = new Limit('t', 2, 1000);
  assert.equal(limit.check('ip', 0), null);
  assert.equal(limit.check('ip', 900), null);
  assert.ok(limit.check('ip', 950), 'still two in the last second');
  assert.equal(limit.check('ip', 1001), null, 'the first has aged out');
});

test('one caller being noisy does not touch anybody else', () => {
  const limit = new Limit('t', 1, 1000);
  assert.equal(limit.check('phone A', 0), null);
  assert.ok(limit.check('phone A', 1), 'A is over');
  assert.equal(limit.check('phone B', 1), null, 'B has not even started');
});

test('callers who go quiet are forgotten, rather than remembered for ever', () => {
  const limit = new Limit('t', 5, 1000);
  for (let i = 0; i < 50; i++) limit.check(`ip${i}`, 0);
  assert.equal(limit.hits.size, 50);
  limit.sweep(5000);
  assert.equal(limit.hits.size, 0, 'a limit table is not a visitor log');
});

test('a caller still inside the window is kept', () => {
  const limit = new Limit('t', 5, 1000);
  limit.check('ip', 0);
  limit.sweep(500);
  assert.equal(limit.hits.size, 1);
});

/* ------------------------------------------------------------------ *
 * Who is asking
 * ------------------------------------------------------------------ */

test('behind a proxy, the caller is the caller and not the proxy', () => {
  assert.equal(
    callerOf({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } }),
    '203.0.113.9',
  );
});

test('without a proxy it is the socket, and failing that, something', () => {
  assert.equal(callerOf({ headers: {}, socket: { remoteAddress: '192.168.1.5' } }), '192.168.1.5');
  assert.equal(callerOf({ headers: {}, socket: {} }), 'unknown');
  assert.equal(callerOf({}), 'unknown');
});

/* ------------------------------------------------------------------ *
 * Through the real server
 * ------------------------------------------------------------------ */

async function withServer(run) {
  _resetRooms();
  for (const limit of Object.values(LIMITS)) limit.reset();
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

const post = (base, path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

test('a loop opening rooms is stopped, and told when to come back', async () => {
  await withServer(async (base) => {
    let refused = null;
    for (let i = 0; i < LIMITS.createRoom.max + 5; i++) {
      const res = await post(base, '/api/rooms', { name: 'Loop' });
      if (res.status === 429) {
        refused = res;
        break;
      }
    }
    assert.ok(refused, 'a loop should eventually be refused');
    assert.ok(Number(refused.headers.get('retry-after')) > 0, 'with a Retry-After');
    const body = await refused.json();
    assert.equal(body.error, 'tooMany');
    assert.ok(body.params.seconds > 0, 'and something to say to the player');
  });
});

test('a whole noisy game is never once told to slow down', async () => {
  // Eight phones, every card looked at, a full round of clues, everybody
  // voting, then played again — with double taps throughout, because that is
  // what people do.
  await withServer(async (base) => {
    const host = await (await post(base, '/api/rooms', { name: 'Ann' })).json();
    const seats = [host];
    for (const name of ['Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal']) {
      seats.push(await (await post(base, `/api/rooms/${host.code}/join`, { name })).json());
    }

    const act = async (seat, action) => {
      const res = await post(base, `/api/rooms/${host.code}/action`, { token: seat.token, action });
      assert.notEqual(res.status, 429, `a player was rate-limited doing ${action.type}`);
      return res;
    };

    for (let game = 0; game < 3; game++) {
      await act(host, { type: 'START_GAME', seed: 5 + game });
      for (const seat of seats) {
        await act(seat, { type: 'MARK_REVEALED' });
        await act(seat, { type: 'MARK_REVEALED' }); // the double tap
      }
      const state = await (await fetch(`${base}/api/rooms/${host.code}?token=${host.token}`)).json();
      for (const id of state.state.order) {
        const seat = seats.find((s) => s.playerId === id);
        await act(seat, { type: 'SUBMIT_CLUE', text: 'word' });
      }
      for (const seat of seats.slice(1)) {
        await act(seat, { type: 'CAST_VOTE', targetId: host.playerId });
      }
      await act(host, { type: 'CAST_VOTE', targetId: seats[1].playerId });
      await act(host, { type: 'CONTINUE' });
      await act(host, { type: 'PLAY_AGAIN' });
    }
  });
});

test('one phone hammering does not lock out the rest of the table', async () => {
  await withServer(async (base) => {
    const host = await (await post(base, '/api/rooms', { name: 'Ann' })).json();
    const guest = await (await post(base, `/api/rooms/${host.code}/join`, { name: 'Ben' })).json();

    // The guest sends nonsense until they are cut off.
    let cutOff = false;
    for (let i = 0; i < LIMITS.action.max + 10; i++) {
      const res = await post(base, `/api/rooms/${host.code}/action`, {
        token: guest.token,
        action: { type: 'MARK_REVEALED' },
      });
      if (res.status === 429) {
        cutOff = true;
        break;
      }
    }
    assert.ok(cutOff, 'the hammering phone is stopped');

    // The host is unaffected, because the budget is per token.
    const res = await post(base, `/api/rooms/${host.code}/action`, {
      token: host.token,
      action: { type: 'SET_CONFIG', config: { scoring: true } },
    });
    assert.notEqual(res.status, 429, 'the rest of the table plays on');
  });
});

test('sweeping every limit at once does not throw', () => {
  assert.doesNotThrow(() => sweepLimits());
});
