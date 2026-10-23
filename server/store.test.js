/**
 * Rooms surviving a restart.
 *
 * The failure this is about: a deploy or a crash mid-evening took every game
 * in progress with it, and the table found out when the next tap said the
 * room did not exist. Nothing in the app could recover from that — the round
 * was simply gone.
 *
 * These tests use their own store file, so they never touch a real one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import '../src/testing/ready.js';

process.env.ROOM_STORE = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'imposter-store-')),
  'rooms.json',
);

const { PHASE } = await import('../src/core/engine.js');
const {
  _resetRooms,
  _reloadRooms,
  createRoom,
  joinRoom,
  dispatch,
  getRoom,
  flushRooms,
  playerForToken,
  roomCount,
} = await import('./rooms.js');
const { STORE_PATH, load, forget, storePathFrom } = await import('./store.js');
const { VERSION } = await import('../src/content/history/changelog.js');

/** A room mid-game, with four phones in it. */
function aGameInProgress() {
  _resetRooms();
  const room = createRoom();
  const seats = ['Ann', 'Ben', 'Cal', 'Dee'].map((name) => joinRoom(room, name));
  const host = seats[0].player.id;
  dispatch(room, host, { type: 'START_GAME', seed: 11 });
  for (const { player } of seats) dispatch(room, player.id, { type: 'MARK_REVEALED' });
  flushRooms();
  return { room, seats, host, code: room.code, word: room.state.secretWord };
}

test('a game in progress comes back after a restart', () => {
  const { code, word, seats } = aGameInProgress();

  // A new process: nothing in memory, only what is on disk.
  const count = _reloadRooms();
  assert.ok(count >= 1, 'the room should have been picked up');

  const back = getRoom(code);
  assert.ok(back, 'the room is still there under the same code');
  assert.equal(back.state.phase, PHASE.CLUES, 'and still in the middle of the round');
  assert.equal(back.state.secretWord, word, 'with the same word');
  assert.deepEqual(
    back.state.players.map((p) => p.name),
    ['Ann', 'Ben', 'Cal', 'Dee'],
    'and the same people',
  );

  // The phones can carry on: their tokens still mean who they were.
  for (const { token, player } of seats) {
    const who = playerForToken(back, token);
    assert.ok(who, 'the token still names somebody');
    assert.equal(who.id, player.id, 'and it is the same somebody');
  }
  assert.equal(back.hostId, seats[0].player.id, 'the host is still the host');
});

test('a phone that comes back can keep playing', () => {
  const { code, seats } = aGameInProgress();
  _reloadRooms();
  const back = getRoom(code);

  // Whoever is up submits a clue into the restored room.
  const up = back.state.order[0];
  assert.doesNotThrow(() => dispatch(back, up, { type: 'SUBMIT_CLUE', text: 'hello' }));
  assert.equal(back.state.clues.length, 1, 'the clue landed');
  assert.ok(seats.length > 0);
});

test('the listeners are not restored, because they cannot be', () => {
  // A socket dies with the process. The room comes back; the phones
  // reconnect to it by themselves, which is what EventSource already does.
  const { code } = aGameInProgress();
  _reloadRooms();
  assert.equal(getRoom(code).listeners.size, 0);
});

test('a room nobody has touched in hours is not brought back', () => {
  const { code } = aGameInProgress();
  // Rewrite the file as though it were written yesterday.
  const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  for (const room of saved.rooms) room.touchedAt = Date.now() - 25 * 60 * 60 * 1000;
  fs.writeFileSync(STORE_PATH, JSON.stringify(saved));

  assert.equal(load().length, 0, 'yesterday is not a game anybody is waiting for');
  _reloadRooms();
  assert.equal(getRoom(code), null);
});

test('a half-written or corrupt file is not allowed to stop the server', () => {
  aGameInProgress();
  fs.writeFileSync(STORE_PATH, '{"rooms":[{"code":"AB');
  assert.doesNotThrow(() => load());
  assert.deepEqual(load(), [], 'nothing comes back, and nothing throws');
  assert.doesNotThrow(() => _reloadRooms());
});

test('junk inside an otherwise valid file is skipped room by room', () => {
  const { code } = aGameInProgress();
  const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  saved.rooms.push(null, 42, { code: 'XXXX' }, { state: {} });
  fs.writeFileSync(STORE_PATH, JSON.stringify(saved));

  const rooms = load();
  assert.equal(rooms.length, 1, 'only the real one');
  assert.equal(rooms[0].code, code);
});

test('no file at all is a perfectly normal first start', () => {
  _resetRooms();
  forget();
  assert.deepEqual(load(), []);
  assert.doesNotThrow(() => _reloadRooms());
  assert.equal(roomCount(), 0);
});

test('the file is written owner-only, because the word is in it', () => {
  aGameInProgress();
  const mode = fs.statSync(STORE_PATH).mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);
  // And the word really is in there, which is the reason for the line above.
  assert.ok(fs.readFileSync(STORE_PATH, 'utf8').includes('secretWord'));
});

test('ROOM_STORE=off keeps nothing, and a path is taken as given', () => {
  // For anyone who would rather a game died with the process.
  assert.equal(storePathFrom({ ROOM_STORE: 'off' }), null);
  assert.equal(storePathFrom({ ROOM_STORE: '/tmp/elsewhere.json' }), '/tmp/elsewhere.json');
  assert.match(storePathFrom({}), /\.rooms\.json$/, 'and otherwise it sits beside the code');
});

test.after(() => {
  forget();
});

test('rooms written by another build are left behind, not guessed at', () => {
  // Every other saved thing in the project checks this. The room file did
  // not, so a deploy that changed the shape of the state fed the old one
  // straight into the new reducer for up to an hour.
  _resetRooms();
  const room = {
    code: 'ZZ99',
    state: { phase: PHASE.CLUES, players: [], secretWord: 'whatever' },
    hostId: 'p1',
    tokens: [['tok', 'p1']],
    createdAt: Date.now(),
    touchedAt: Date.now(),
  };
  const write = (envelope) => fs.writeFileSync(STORE_PATH, JSON.stringify(envelope));

  write({ v: '99.0.0', savedAt: Date.now(), rooms: [room] });
  assert.deepEqual(load(), [], "a future build's rooms are not restored");

  // And one with no version at all — which is every file written before the
  // check existed.
  write({ savedAt: Date.now(), rooms: [room] });
  assert.deepEqual(load(), []);

  // Our own come back as they always did.
  write({ v: VERSION, savedAt: Date.now(), rooms: [room] });
  assert.equal(load().length, 1);

  forget();
});
