/**
 * The payload a phone is sent, built as text.
 *
 * `broadcast` serialises the half of the payload that everybody shares once
 * per room rather than once per phone, and splices it into a small string per
 * listener. That is a worthwhile saving and a terrible place for a bug: the
 * output is JSON assembled by hand, and nothing about a missing comma or a
 * mis-escaped name is obvious until a phone somewhere refuses to parse a
 * round.
 *
 * So these hold the text version to the object version, field by field, for
 * every phase and every kind of player — and particularly for names that
 * would break naive escaping, since a name is the one thing in here typed by
 * somebody at the table.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PHASE } from '../src/core/engine.js';
import '../src/testing/ready.js';
import {
  _resetRooms,
  createRoom,
  joinRoom,
  dispatch,
  payloadFor,
  payloadTextFor,
  broadcast,
  addListener,
} from './rooms.js';

/** A room with people in it, at whatever phase is asked for. */
function aRoom(names = ['Ann', 'Ben', 'Cal', 'Dee'], phase = PHASE.LOBBY) {
  _resetRooms();
  const room = createRoom();
  const seats = names.map((name) => joinRoom(room, name));
  const host = seats[0].player.id;

  if (phase !== PHASE.LOBBY) {
    dispatch(room, host, { type: 'START_GAME', seed: 7 });
    if (phase !== PHASE.REVEAL) {
      for (const { player } of seats) dispatch(room, player.id, { type: 'MARK_REVEALED' });
    }
  }
  return { room, seats, host };
}

/** The text and the object have to be the same thing. */
function same(room, playerId, what) {
  const asText = payloadTextFor(room, playerId);
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(asText);
  }, `${what}: the payload is not valid JSON\n${asText.slice(0, 200)}`);
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(payloadFor(room, playerId))), what);
  return parsed;
}

test('in the lobby, every phone is sent what it was always sent', () => {
  const { room, seats } = aRoom();
  for (const { player } of seats) same(room, player.id, `lobby, ${player.name}`);
});

test('mid-game, the host and a guest each get their own view', () => {
  const { room, seats } = aRoom(['Ann', 'Ben', 'Cal', 'Dee'], PHASE.CLUES);
  const host = same(room, seats[0].player.id, 'the host');
  const guest = same(room, seats[1].player.id, 'a guest');

  assert.equal(host.isHost, true);
  assert.equal(guest.isHost, false);
  assert.ok(host.private, 'the host has a card');
  assert.ok(guest.private, 'so does the guest');
  assert.notDeepEqual(host.private, guest.private, 'and they are not the same card');
  assert.deepEqual(host.state, guest.state, 'but the shared half really is shared');
});

test('the same state is serialised once and sent to everybody', () => {
  const { room, seats } = aRoom(['Ann', 'Ben', 'Cal', 'Dee'], PHASE.CLUES);
  const frames = [];
  for (const { player } of seats) addListener(room, player.id, (text) => frames.push(text), () => {});
  frames.length = 0;

  broadcast(room);
  assert.equal(frames.length, seats.length, 'one frame per phone');

  const states = frames.map((f) => JSON.parse(f).state);
  for (const state of states) assert.deepEqual(state, states[0], 'one state, four phones');
  // And each phone is still told who it is.
  const whos = frames.map((f) => JSON.parse(f).you);
  assert.equal(new Set(whos).size, seats.length, 'every phone is told it is itself');
});

test('a name that would break hand-written JSON does not', () => {
  // The one field in here typed by a person at a table.
  const awkward = ['Ann "The Ace"', 'B\\ckslash', 'Zoë 😀', 'new\tline'];
  const { room, seats } = aRoom(awkward);
  for (const { player } of seats) {
    const parsed = same(room, player.id, `awkward name ${JSON.stringify(player.name)}`);
    assert.ok(
      parsed.state.players.some((p) => p.name === player.name),
      'the name survived the round trip exactly',
    );
  }
});

test('a room code and a null host serialise properly', () => {
  _resetRooms();
  const room = createRoom();
  // Nobody has joined, so there is no host and no player to be.
  const parsed = JSON.parse(payloadTextFor(room, null));
  assert.equal(parsed.hostId, null);
  assert.equal(parsed.you, null);
  assert.equal(parsed.isHost, false);
  assert.equal(parsed.private, null);
  assert.equal(parsed.code, room.code);
});

test('the word is not in anything sent to a phone', () => {
  // The reason the public half exists at all. If the splicing ever reached
  // for the wrong object, this is what would catch it.
  const { room, seats } = aRoom(['Ann', 'Ben', 'Cal', 'Dee'], PHASE.CLUES);
  const word = room.state.secretWord;
  assert.ok(word, 'there should be a word');

  for (const { player } of seats) {
    const text = payloadTextFor(room, player.id);
    const parsed = JSON.parse(text);
    assert.ok(
      !JSON.stringify(parsed.state).includes(word),
      `the word reached ${player.name} in the shared half`,
    );
    // The imposter's own card legitimately holds their word; a crew card
    // holds the real one. What matters is that neither leaks to the others.
    assert.equal(parsed.state.secretWord, null);
    assert.deepEqual(parsed.state.imposterIds, []);
    assert.deepEqual(parsed.state.roles, {});
  }
});

test('a listener that throws is dropped rather than taking the room with it', () => {
  // A phone that has gone away mid-write.
  const { room, seats } = aRoom();
  addListener(room, seats[0].player.id, () => {
    throw new Error('socket gone');
  }, () => {});
  const good = [];
  addListener(room, seats[1].player.id, (t) => good.push(t), () => {});

  assert.doesNotThrow(() => broadcast(room));
  assert.equal(good.length > 0, true, 'the working phone still got its frame');
  assert.equal(room.listeners.size, 1, 'the broken one was dropped');
});
