/**
 * End-to-end test: four "phones" play a whole game over HTTP against a real
 * server instance, including the live SSE stream.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from './server.js';
import { _resetRooms } from './rooms.js';
import { _resetLimits } from './limits.js';
import '../src/testing/ready.js';
import {
  PHASE,
  DECOY,
  IMPOSTERS_AUTO,
  IMPOSTERS_RANDOM,
  ROUNDS_UNLIMITED,
} from '../src/core/engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */

async function withServer(run) {
  _resetRooms();
  _resetLimits();
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    // SSE connections stay open by design, so drop them before closing.
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
};

const act = (base, code, token, action) =>
  post(`${base}/api/rooms/${code}/action`, { token, action });

const peek = async (base, code, token) =>
  (await fetch(`${base}/api/rooms/${code}?token=${token}`)).json();

/** Read Server-Sent Events into a growing array of payloads. */
function openStream(base, code, token) {
  const controller = new AbortController();
  const events = [];
  const ready = fetch(`${base}/api/rooms/${code}/stream?token=${token}`, {
    signal: controller.signal,
  }).then(async (res) => {
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, i);
            buf = buf.slice(i + 2);
            if (frame.startsWith('data: ')) events.push(JSON.parse(frame.slice(6)));
          }
        }
      } catch {
        /* aborted */
      }
    })();
  });
  return { events, ready, close: () => controller.abort() };
}

const settle = () => new Promise((r) => setTimeout(r, 60));

/* ------------------------------------------------------------------ */

test('four players join, play a full game, and only ever see their own card', async () => {
  await withServer(async (base) => {
    // Host opens a room
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    assert.match(host.code, /^[A-Z2-9]{4,12}$/);

    // Three friends join with the code
    const others = [];
    for (const name of ['Ben', 'Cal', 'Dee']) {
      const r = await post(`${base}/api/rooms/${host.code}/join`, { name });
      assert.equal(r.status, 200);
      others.push(r.body);
    }
    const everyone = [host, ...others];

    // A phone subscribes to live updates
    const stream = openStream(base, host.code, host.token);
    await stream.ready;
    await settle();
    assert.equal(stream.events.at(-1).state.players.length, 4);

    // Host starts; the stream is pushed the change without asking
    const before = stream.events.length;
    await act(base, host.code, host.token, { type: 'START_GAME' });
    await settle();
    assert.ok(stream.events.length > before, 'the start should have been pushed');
    assert.equal(stream.events.at(-1).state.phase, PHASE.REVEAL);

    // Each player sees exactly one card, and the shared state holds no secrets
    const views = [];
    for (const p of everyone) {
      const view = await peek(base, host.code, p.token);
      assert.equal(view.state.secretWord, null, 'the word must not be in the shared state');
      assert.deepEqual(view.state.imposterIds, [], 'roles must not be in the shared state');
      assert.ok(view.private.role);
      views.push(view);
    }
    const imposters = views.filter((v) => v.private.role === 'imposter');
    const crew = views.filter((v) => v.private.role === 'crew');
    assert.equal(imposters.length, 1);
    assert.equal(crew.length, 3);
    // All crew were told the same word; the imposter was told a different one
    assert.equal(new Set(crew.map((v) => v.private.word)).size, 1);
    assert.notEqual(imposters[0].private.word, crew[0].private.word);

    // Everyone looks at their card
    for (const p of everyone) await act(base, host.code, p.token, { type: 'MARK_REVEALED' });
    let view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.CLUES);

    // Clue round, in turn
    const tokenFor = (id) => everyone.find((p) => p.playerId === id).token;
    for (let i = 0; i < 4; i++) {
      view = await peek(base, host.code, host.token);
      const order = view.state.order.filter((id) => !view.state.eliminated.includes(id));
      const given = new Set(
        view.state.clues.filter((c) => c.round === view.state.round).map((c) => c.playerId),
      );
      const turn = order.find((id) => !given.has(id));
      const r = await act(base, host.code, tokenFor(turn), {
        type: 'SUBMIT_CLUE',
        text: `guess${i}`,
      });
      assert.equal(r.status, 200);
    }

    view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.VOTE);

    // Everyone votes for the imposter (the imposter has to vote for someone else)
    const imposterId = imposters[0].you;
    for (const p of everyone) {
      const target =
        p.playerId === imposterId
          ? everyone.find((q) => q.playerId !== imposterId).playerId
          : imposterId;
      const r = await act(base, host.code, p.token, { type: 'CAST_VOTE', targetId: target });
      assert.equal(r.status, 200);
    }

    view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.VERDICT);
    assert.equal(view.state.lastVote.eliminatedId, imposterId);

    // Host turns the verdict card over -> the imposter gets a steal attempt
    await act(base, host.code, host.token, { type: 'CONTINUE' });
    view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.STEAL);

    await act(base, host.code, tokenFor(imposterId), {
      type: 'STEAL_GUESS',
      text: 'a wrong word',
    });

    view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.GAME_OVER);
    assert.equal(view.state.result.winner, 'crew');
    assert.ok(view.state.secretWord, 'the word is revealed once the game is over');

    stream.close();
  });
});

test('you cannot act as another player, and only the host can start', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const ben = (await post(`${base}/api/rooms/${host.code}/join`, { name: 'Ben' })).body;
    await post(`${base}/api/rooms/${host.code}/join`, { name: 'Cal' });

    const notHost = await act(base, host.code, ben.token, { type: 'START_GAME' });
    assert.equal(notHost.status, 400);
    assert.equal(notHost.body.error, 'hostOnly');

    await act(base, host.code, host.token, { type: 'START_GAME' });

    // Ben marks a card revealed; the server records it as BEN's regardless of
    // what the request claims.
    await act(base, host.code, ben.token, { type: 'MARK_REVEALED', playerId: host.playerId });
    const view = await peek(base, host.code, host.token);
    assert.deepEqual(view.state.revealed, [ben.playerId]);
  });
});

test('only an imposter may attempt the steal', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const rest = [];
    for (const name of ['Ben', 'Cal']) {
      rest.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    const everyone = [host, ...rest];
    await act(base, host.code, host.token, { type: 'START_GAME' });
    for (const p of everyone) await act(base, host.code, p.token, { type: 'MARK_REVEALED' });

    const tokenFor = (id) => everyone.find((p) => p.playerId === id).token;
    for (let i = 0; i < 3; i++) {
      const view = await peek(base, host.code, host.token);
      const given = new Set(view.state.clues.map((c) => c.playerId));
      const turn = view.state.order.find((id) => !given.has(id));
      await act(base, host.code, tokenFor(turn), { type: 'SUBMIT_CLUE', text: `clue${i}` });
    }

    // Find the imposter by asking each phone what it was told
    let imposterId = null;
    for (const p of everyone) {
      const v = await peek(base, host.code, p.token);
      if (v.private.role === 'imposter') imposterId = p.playerId;
    }

    for (const p of everyone) {
      const target =
        p.playerId === imposterId
          ? everyone.find((q) => q.playerId !== imposterId).playerId
          : imposterId;
      await act(base, host.code, p.token, { type: 'CAST_VOTE', targetId: target });
    }
    await act(base, host.code, host.token, { type: 'CONTINUE' });

    const crewMember = everyone.find((p) => p.playerId !== imposterId);
    const bad = await act(base, host.code, crewMember.token, {
      type: 'STEAL_GUESS',
      text: 'anything',
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'notImposter');
  });
});

test('a bad room code and a stale token are refused politely', async () => {
  await withServer(async (base) => {
    const missing = await post(`${base}/api/rooms/ZZZZ/join`, { name: 'Ann' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'noSuchRoom');

    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const stale = await act(base, host.code, 'not-a-real-token', { type: 'START_GAME' });
    assert.equal(stale.status, 401);
  });
});

test('every connected phone is pushed the same update', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const ben = (await post(`${base}/api/rooms/${host.code}/join`, { name: 'Ben' })).body;

    const a = openStream(base, host.code, host.token);
    const b = openStream(base, host.code, ben.token);
    await Promise.all([a.ready, b.ready]);
    await settle();

    await post(`${base}/api/rooms/${host.code}/join`, { name: 'Cal' });
    await settle();

    assert.equal(a.events.at(-1).state.players.length, 3);
    assert.equal(b.events.at(-1).state.players.length, 3);
    assert.equal(a.events.at(-1).isHost, true);
    assert.equal(b.events.at(-1).isHost, false);

    a.close();
    b.close();
  });
});

test('the host sets the word language and everyone gets words from it', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Fern' })).body;
    const rest = [];
    for (const name of ['Noi', 'Tom']) {
      rest.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    const everyone = [host, ...rest];

    // Only the host may change it
    const guestTry = await act(base, host.code, rest[0].token, {
      type: 'SET_CONFIG',
      config: { wordLang: 'th' },
    });
    assert.equal(guestTry.body.error, 'hostOnly');

    await act(base, host.code, host.token, { type: 'SET_CONFIG', config: { wordLang: 'th' } });
    await act(base, host.code, host.token, { type: 'START_GAME' });

    const words = [];
    for (const p of everyone) {
      const view = await peek(base, host.code, p.token);
      assert.equal(view.state.config.wordLang, 'th');
      words.push(view.private.word);
    }
    // Everyone was dealt a Thai word, whatever language their phone is in
    for (const w of words) assert.match(w, /[฀-๿]/, `not Thai: ${w}`);
  });
});

test('a crew member cannot call the word, and the imposter can win with it', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Fern' })).body;
    const rest = [];
    for (const name of ['Noi', 'Tom']) {
      rest.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    const everyone = [host, ...rest];
    await act(base, host.code, host.token, { type: 'START_GAME' });
    for (const p of everyone) await act(base, host.code, p.token, { type: 'MARK_REVEALED' });

    // Find the imposter, and the word, by asking each phone what it holds
    let imposter = null;
    let secret = null;
    for (const p of everyone) {
      const v = await peek(base, host.code, p.token);
      if (v.private.role === 'imposter') imposter = p;
      else secret = v.private.word;
    }

    const crew = everyone.find((p) => p !== imposter);
    const refused = await act(base, host.code, crew.token, {
      type: 'CALL_WORD',
      text: secret,
    });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error, 'notImposter');

    const called = await act(base, host.code, imposter.token, {
      type: 'CALL_WORD',
      text: secret,
    });
    assert.equal(called.status, 200);

    const view = await peek(base, host.code, host.token);
    assert.equal(view.state.phase, PHASE.GAME_OVER);
    assert.equal(view.state.result.winner, 'imposters');
    assert.equal(view.state.result.reason, 'called');
  });
});

test('a random imposter count never reaches the players', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Fern' })).body;
    const everyone = [host];
    for (const name of ['Noi', 'Tom', 'Ploy', 'Max']) {
      everyone.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    await act(base, host.code, host.token, {
      type: 'SET_CONFIG',
      config: { imposterCount: 'random' },
    });
    await act(base, host.code, host.token, { type: 'START_GAME' });

    for (const p of everyone) {
      const view = await peek(base, host.code, p.token);
      assert.equal(view.state.imposterCount, null, 'the count must not be published');
      assert.deepEqual(view.state.imposterIds, []);
      assert.equal(view.state.config.imposterCount, 'random');
      // and nothing anywhere in the payload counts them for you
      const asText = JSON.stringify(view.state);
      assert.ok(!/"imposterIds":\[".+"\]/.test(asText), 'roles leaked into the payload');
    }
  });
});

test('blind mode tells no phone what its owner is', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Fern' })).body;
    const everyone = [host];
    for (const name of ['Noi', 'Tom', 'Ploy']) {
      everyone.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    await act(base, host.code, host.token, {
      type: 'SET_CONFIG',
      config: { imposterKnows: false, decoyMode: 'blank', allowCall: true },
    });

    // The lobby should already show the settings that will actually be played
    let view = await peek(base, host.code, host.token);
    assert.equal(view.state.config.decoyMode, 'related', 'blank must be corrected');
    assert.equal(view.state.config.allowCall, false, 'calling must be off');

    await act(base, host.code, host.token, { type: 'START_GAME' });

    const words = [];
    for (const p of everyone) {
      const v = await peek(base, host.code, p.token);
      assert.equal(v.private.role, 'unknown', 'no phone may be told its role');
      assert.deepEqual(v.private.fellowImposters, []);
      assert.ok(v.private.word, 'everyone still gets a word');
      words.push(v.private.word);
    }
    // Exactly one word differs, but nothing says whose
    const counts = {};
    for (const w of words) counts[w] = (counts[w] || 0) + 1;
    assert.equal(Object.keys(counts).length, 2, `expected two words, got ${words}`);

    // Calling is refused even if a client asks anyway
    const sneaky = await act(base, host.code, host.token, {
      type: 'CALL_WORD',
      text: words[0],
    });
    assert.equal(sneaky.status, 400);
    assert.equal(sneaky.body.error, 'callsOff');
  });
});

test('a room does not deal the same word or imposter twice running', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Fern' })).body;
    const everyone = [host];
    for (const name of ['Noi', 'Tom', 'Ploy', 'Max']) {
      everyone.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }

    const seen = [];
    for (let game = 0; game < 6; game++) {
      await act(base, host.code, host.token, { type: 'START_GAME' });

      // Whatever the crew were told is the word; whoever was not is the imposter.
      let word = null;
      let imposter = null;
      for (const p of everyone) {
        const v = await peek(base, host.code, p.token);
        if (v.private.role === 'imposter') imposter = p.playerId;
        else word = v.private.word;
        // The history must never travel, in any phase
        assert.ok(!('history' in v.state), 'history reached a client');
      }
      seen.push({ word, imposter });

      const view = await peek(base, host.code, host.token);
      assert.ok(
        !JSON.stringify(view.state).includes(word),
        'the word in play appeared in the shared state',
      );

      await act(base, host.code, host.token, { type: 'PLAY_AGAIN' });
    }

    for (let i = 1; i < seen.length; i++) {
      assert.notEqual(seen[i].word, seen[i - 1].word, `word repeated at game ${i}`);
      assert.notEqual(seen[i].imposter, seen[i - 1].imposter, `imposter repeated at game ${i}`);
    }
  });
});

test('a malformed request is refused and the server carries on', async () => {
  await withServer(async (base) => {
    const raw = (path, init) => fetch(`${base}${path}`, init);

    // not JSON at all
    let res = await raw('/api/rooms', { method: 'POST', body: '{oh no' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'badJson');

    // bigger than the body limit: the connection is dropped mid-upload rather
    // than read to the end, so the client sees a network error. What matters
    // is that the server is not left holding it.
    const oversized = await raw('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name: 'x'.repeat(70_000) }),
    }).then((r) => r.status, () => 'dropped');
    assert.ok(oversized === 'dropped' || oversized >= 400, `got ${oversized}`);

    // a real room, then nonsense aimed at it
    const { body: room } = await post(`${base}/api/rooms`, { name: 'Host' });
    const bad = [
      {},                                             // no token, no action
      { token: room.token },                          // no action
      { token: 'not-a-token', action: { type: 'START_GAME' } },
      { token: room.token, action: {} },              // no type
      { token: room.token, action: { type: 'NOPE' } },
      { token: room.token, action: { type: 'ADD_PLAYER', name: null } },
      { token: room.token, action: 'START_GAME' },    // action is not an object
    ];
    for (const payload of bad) {
      const r = await post(`${base}/api/rooms/${room.code}/action`, payload);
      assert.ok(r.status >= 400 && r.status < 500, `${JSON.stringify(payload)} → ${r.status}`);
      assert.ok(r.body.error, 'an error should come back with a code');
    }

    // Nonsense settings are not refused — an older phone sending a pack this
    // version dropped should not break the room — but they must never reach
    // the deal. They are coerced back to something playable, and the lobby
    // shows what will actually be played.
    const junk = await post(`${base}/api/rooms/${room.code}/action`, {
      token: room.token,
      action: {
        type: 'SET_CONFIG',
        config: {
          maxRounds: 'lots',
          imposterCount: {},
          decoyMode: 'sideways',
          wordLang: 'klingon',
          packIds: 'everything',
          allowCall: 'yes please',
        },
      },
    });
    assert.equal(junk.status, 200);
    const { state } = await peek(base, room.code, room.token);
    assert.ok(
      state.config.maxRounds === ROUNDS_UNLIMITED || Number.isInteger(state.config.maxRounds),
      `maxRounds came back as ${JSON.stringify(state.config.maxRounds)}`,
    );
    assert.ok([IMPOSTERS_AUTO, IMPOSTERS_RANDOM].includes(state.config.imposterCount) ||
      Number.isInteger(state.config.imposterCount));
    assert.ok(Object.values(DECOY).includes(state.config.decoyMode));
    assert.ok(['en', 'th', 'de'].includes(state.config.wordLang));
    assert.deepEqual(state.config.packIds, []);
    assert.equal(typeof state.config.allowCall, 'boolean');

    // unknown paths and methods
    assert.equal((await raw('/api/rooms/ZZZZ')).status, 404);
    assert.equal((await raw('/api/nothing')).status, 404);
    assert.equal((await raw(`/api/rooms/${room.code}`, { method: 'DELETE' })).status, 404);

    // still alive and still holding the room
    const health = await (await raw('/api/health')).json();
    assert.equal(health.ok, true);
    assert.equal(health.rooms, 1);

    // and the room still works
    const { body: joined } = await post(`${base}/api/rooms/${room.code}/join`, { name: 'Guest' });
    assert.ok(joined.token);
  });
});

test('a longer room code can be asked for, and everything still lines up', async () => {
  // A deployment on the open internet has a public address, so it can ask for
  // codes too long to stumble into. The length is read once at startup, so
  // this runs a server of its own in a child process rather than poking the
  // module that is already loaded here.
  const { execPath } = process;
  const child = spawn(execPath, [path.join(here, 'server.js')], {
    env: { ...process.env, PORT: '0', ROOM_CODE_LENGTH: '8' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('the server never said it was up')), 8000);
      child.stdout.on('data', (chunk) => {
        const found = /http:\/\/localhost:(\d+)/.exec(String(chunk));
        if (found) {
          clearTimeout(timer);
          resolve(Number(found[1]));
        }
      });
    });
    const base = `http://127.0.0.1:${port}`;

    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.codeLength, 8, 'the health endpoint should say how long a code is');

    const { body: room } = await post(`${base}/api/rooms`, { name: 'Host' });
    assert.match(room.code, /^[A-Z2-9]{8}$/, `got ${room.code}`);

    // and a guest can still find it by that code
    const { status, body: guest } = await post(`${base}/api/rooms/${room.code}/join`, {
      name: 'Guest',
    });
    assert.equal(status, 200);
    assert.ok(guest.token);
  } finally {
    child.kill();
  }
});

test('the health endpoint answers', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
});

/* ------------------------------------------------------------------ *
 * Leaving, being kicked, and who is allowed to do what
 *
 * Every test here is a scenario that used to end the evening: a room nobody
 * could play, a phone watching a game it had been thrown out of, or a guest
 * rewriting the table's word list.
 * ------------------------------------------------------------------ */

test('the host leaving the lobby hands the room to somebody else', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const guests = [];
    for (const name of ['Ben', 'Cal', 'Dee']) {
      guests.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }

    const bye = await post(`${base}/api/rooms/${host.code}/leave`, { token: host.token });
    assert.equal(bye.status, 200);

    const seen = await peek(base, host.code, guests[0].token);
    assert.deepEqual(
      seen.state.players.map((p) => p.name),
      ['Ben', 'Cal', 'Dee'],
      'the host is out of the roster',
    );
    assert.equal(seen.isHost, true, 'the next phone in the room has the crown');

    // The whole point: the round can still be started. Before, every
    // host-only action was refused forever and the table had to open a new
    // room and read out a new code.
    const started = await act(base, host.code, guests[0].token, { type: 'START_GAME' });
    assert.equal(started.status, 200);
  });
});

test('a host leaving mid-game passes the crown without un-dealing a card', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const guests = [];
    for (const name of ['Ben', 'Cal', 'Dee']) {
      guests.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    await act(base, host.code, host.token, { type: 'START_GAME' });

    await post(`${base}/api/rooms/${host.code}/leave`, { token: host.token });
    const seen = await peek(base, host.code, guests[0].token);

    assert.equal(seen.state.players.length, 4, 'the dealt roster is untouched');
    assert.equal(seen.isHost, true, 'but somebody can move the round along');
    assert.notEqual(seen.hostId, host.playerId);
  });
});

test('leaving twice is not an error', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    await post(`${base}/api/rooms/${host.code}/join`, { name: 'Ben' });
    assert.equal((await post(`${base}/api/rooms/${host.code}/leave`, { token: host.token })).status, 200);
    assert.equal((await post(`${base}/api/rooms/${host.code}/leave`, { token: host.token })).status, 200);
  });
});

test('the last player cannot leave the room out from under itself', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    await post(`${base}/api/rooms/${host.code}/leave`, { token: host.token });
    const seen = await peek(base, host.code, host.token);
    // An empty roster would be a room that exists and cannot be joined into
    // a game; the sweeper takes it in its own time instead.
    assert.equal(seen.state.players.length, 1);
  });
});

test('a kicked phone stops receiving the game and its token stops working', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const kicked = (await post(`${base}/api/rooms/${host.code}/join`, { name: 'Ben' })).body;
    for (const name of ['Cal', 'Dee', 'Eve']) {
      await post(`${base}/api/rooms/${host.code}/join`, { name });
    }

    const stream = openStream(base, host.code, kicked.token);
    await stream.ready;
    await settle();
    const before = stream.events.length;
    assert.ok(before >= 1, 'the stream was live to begin with');

    await act(base, host.code, host.token, { type: 'REMOVE_PLAYER', playerId: kicked.playerId });
    await settle();
    const atKick = stream.events.length;

    await act(base, host.code, host.token, { type: 'START_GAME' });
    await settle();

    assert.equal(
      stream.events.length,
      atKick,
      'a kicked phone was still being sent every frame of the game',
    );

    // It also held a working token, which is how it kept the seed and could
    // act as a player who was no longer in the room.
    const stale = await act(base, host.code, kicked.token, { type: 'MARK_REVEALED' });
    assert.equal(stale.status, 401);
    assert.equal(stale.body.error, 'staleToken');

    stream.close();
  });
});

test('only the host can change the room word packs', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const guest = (await post(`${base}/api/rooms/${host.code}/join`, { name: 'Ben' })).body;

    const pack = {
      name: 'Ours',
      pairs: [
        { word: 'alpha', decoy: 'beta' },
        { word: 'gamma', decoy: 'delta' },
        { word: 'epsilon', decoy: 'zeta' },
        { word: 'eta', decoy: 'theta' },
        { word: 'iota', decoy: 'kappa' },
      ],
    };
    assert.equal((await act(base, host.code, host.token, { type: 'SET_CUSTOM_PACKS', packs: [pack] })).status, 200);
    assert.equal((await peek(base, host.code, host.token)).state.customPacks.length, 1);

    // A guest POSTing straight at the endpoint, past a client that only ever
    // sends this when it believes it is the host.
    const wipe = await act(base, host.code, guest.token, { type: 'SET_CUSTOM_PACKS', packs: [] });
    assert.equal(wipe.status, 400);
    assert.equal(wipe.body.error, 'hostOnly');

    const swap = await act(base, host.code, guest.token, {
      type: 'SET_CUSTOM_PACKS',
      packs: [{ name: 'Mine', pairs: pack.pairs }],
    });
    assert.equal(swap.status, 400);

    const after = (await peek(base, host.code, host.token)).state.customPacks;
    assert.equal(after.length, 1);
    assert.equal(after[0].name, 'Ours', "the table's pack survived");
  });
});

test('no phone is ever sent the seed, whatever else is on the wire', async () => {
  await withServer(async (base) => {
    const host = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    const guests = [];
    for (const name of ['Ben', 'Cal', 'Dee']) {
      guests.push((await post(`${base}/api/rooms/${host.code}/join`, { name })).body);
    }
    const stream = openStream(base, host.code, guests[0].token);
    await stream.ready;
    await act(base, host.code, host.token, { type: 'START_GAME' });
    await settle();

    assert.ok(stream.events.length >= 2);
    for (const frame of stream.events) {
      assert.equal(frame.state.seed, null, 'the deal seed went out over the wire');
    }
    assert.equal((await peek(base, host.code, guests[0].token)).state.seed, null);
    stream.close();
  });
});

test('a room deals in the language the host is reading, not always English', async () => {
  await withServer(async (base) => {
    // The one-phone mode has always seeded the word language from the
    // interface language. A room did not, so a German table opened a room and
    // got cards reading "Civil servant" under a German interface.
    const de = (await post(`${base}/api/rooms`, { name: 'Anna', wordLang: 'de' })).body;
    assert.equal((await peek(base, de.code, de.token)).state.config.wordLang, 'de');

    const th = (await post(`${base}/api/rooms`, { name: 'ธนะ', wordLang: 'th' })).body;
    assert.equal((await peek(base, th.code, th.token)).state.config.wordLang, 'th');

    // Anything unrecognised falls back rather than reaching the deal, and a
    // phone that sends nothing still gets a working room.
    const junk = (await post(`${base}/api/rooms`, { name: 'Ann', wordLang: 'klingon' })).body;
    assert.equal((await peek(base, junk.code, junk.token)).state.config.wordLang, 'en');
    const quiet = (await post(`${base}/api/rooms`, { name: 'Ann' })).body;
    assert.equal((await peek(base, quiet.code, quiet.token)).state.config.wordLang, 'en');
  });
});
