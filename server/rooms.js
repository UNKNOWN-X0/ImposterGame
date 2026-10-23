/**
 * Room bookkeeping for LAN play.
 *
 * The server is the single source of truth: it owns the game state and every
 * client just renders what it is told. That is what stops a player from
 * opening dev tools and reading the secret word — the word is never sent to
 * anyone who should not have it.
 */

import * as store from './store.js';
import {
  PHASE,
  createGame,
  reduce,
  publicState,
  viewFor,
  playerById,
  GameError,
} from '../src/core/engine.js';

// No I, O, 0 or 1 — they are unreadable when someone is squinting at a screen
// across the table.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/**
 * Four characters is right for a room: it gets read out loud across a table,
 * and on one wifi nobody else can reach the server anyway. A deployment on
 * the open internet is a different situation — the address is public, and a
 * four-character code is short enough to stumble into — so a host can ask for
 * a longer one. The alphabet leaves out I, O, 0 and 1 either way, because
 * somebody always mishears them.
 */
export const CODE_LENGTH = Math.min(12, Math.max(4, Number(process.env.ROOM_CODE_LENGTH) || 4));
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // rooms evaporate after six idle hours

const rooms = new Map();

/**
 * Whatever the last process was in the middle of.
 *
 * Read once, on the way up, before anything else can ask for a room. A code
 * handed out five minutes ago has to keep meaning the same room, so this has
 * to happen before the first `createRoom` picks one — otherwise the new
 * process could hand out a code the old one is still using.
 */
let restored = false;
function restoreOnce() {
  if (restored) return;
  restored = true;
  for (const room of store.load()) rooms.set(room.code, room);
  if (rooms.size) console.log(`[rooms] ${rooms.size} game(s) picked up where they left off`);
}

const randomFrom = (alphabet, n) =>
  Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

function newCode() {
  restoreOnce();
  let code;
  do {
    code = randomFrom(CODE_ALPHABET, CODE_LENGTH);
  } while (rooms.has(code));
  return code;
}

const newToken = () => randomFrom('abcdefghijklmnopqrstuvwxyz0123456789', 24);

/**
 * Open a room.
 *
 * `config` is whatever the host's phone asked for, and it goes through
 * `normaliseConfig` inside `createGame` like any other config — so an
 * unknown language or a nonsense value falls back to the default rather than
 * reaching the deal. Today it carries one thing: the language the host is
 * reading the buttons in, because a room used to deal English words to a
 * German table while the one-phone mode on the same phone did not.
 */
export function createRoom(config = {}) {
  const code = newCode();
  const room = {
    code,
    state: createGame(config),
    hostId: null,
    tokens: new Map(), // token -> playerId
    listeners: new Set(), // { playerId, send }
    createdAt: Date.now(),
    touchedAt: Date.now(),
  };
  rooms.set(code, room);
  store.save(rooms);
  return room;
}

export function getRoom(code) {
  restoreOnce();
  return rooms.get(String(code || '').toUpperCase()) || null;
}

export function roomCount() {
  restoreOnce();
  return rooms.size;
}

/** Drop rooms nobody has touched in a long while. */
export function sweepRooms(now = Date.now()) {
  let swept = false;
  for (const [code, room] of rooms) {
    if (now - room.touchedAt > ROOM_TTL_MS) {
      for (const l of room.listeners) l.close?.();
      rooms.delete(code);
      swept = true;
    }
  }
  if (swept) store.save(rooms);
}

/** Test helper — wipes every room. */
export function _resetRooms() {
  rooms.clear();
  restored = true; // a test starts from nothing, not from last night
  store.forget();
}

/**
 * Write anything owed to disk right now — for a clean shutdown.
 *
 * The guard is the whole point. `restoreOnce` runs lazily, from the first
 * call that needs a room, so a process that only ever served static files —
 * or was replaced by a rolling deploy before any traffic arrived, or is in a
 * restart loop — has an empty Map and has never read the file. Flushing that
 * Map wrote `rooms: []` over a file holding live games: the handler written
 * to save everybody's round was the thing that ended it. Nothing owed means
 * nothing to write.
 */
export function flushRooms() {
  if (!restored) return undefined;
  return store.flush(rooms);
}

/** Test helper: pretend this is a fresh process that has not read the file. */
export function _reloadRooms() {
  rooms.clear();
  restored = false;
  restoreOnce();
  return rooms.size;
}

/* ------------------------------------------------------------------ */

export function joinRoom(room, name) {
  const before = room.state.players.length;
  room.state = reduce(room.state, { type: 'ADD_PLAYER', name });
  const player = room.state.players[room.state.players.length - 1];
  if (before === 0) room.hostId = player.id;
  const token = newToken();
  room.tokens.set(token, player.id);
  room.touchedAt = Date.now();
  store.save(rooms);
  // Everyone already staring at the lobby should see the new name appear.
  broadcast(room);
  return { player, token };
}

export function playerForToken(room, token) {
  const id = room.tokens.get(token);
  return id ? playerById(room.state, id) : null;
}

/**
 * Forget a phone: its tokens and its open stream.
 *
 * The engine cleans everything it keys by a player, but a token and an SSE
 * listener are not game state and it has never heard of them. Without this a
 * kicked player kept both: they went on receiving every frame of a game they
 * were no longer in, and the moment it started their own screen asked for a
 * private view the server had stopped building and threw on `null`.
 */
function forgetPlayer(room, playerId) {
  for (const [token, id] of room.tokens) if (id === playerId) room.tokens.delete(token);
  for (const l of room.listeners) {
    if (l.playerId !== playerId) continue;
    room.listeners.delete(l);
    try {
      l.close?.();
    } catch {
      /* already gone; nothing to close */
    }
  }
}

/**
 * Hand the room to somebody else.
 *
 * `hostId` was assigned once, when the room was empty, and never again. That
 * made the host permanent: every host-only action — including CONTINUE and
 * FORCE_VOTE, the two that move a round along — is refused for anybody else,
 * so a host who tapped Leave, cleared their browser or simply ran out of
 * battery left a room that could not be played and could not be repaired.
 * Rejoining did not help: a rejoin mints a new id, so the crown stayed with
 * a player who was no longer there.
 *
 * The next phone in the room takes it. In a dealt game that is somebody still
 * playing, so the round can carry on.
 */
function passHost(room, awayFrom) {
  if (room.hostId !== awayFrom) return;
  const others = room.state.players.filter((p) => p.id !== awayFrom);
  // Somebody actually looking at the room first: a phone with an open stream
  // is a person at the table, where a player with no connection may be the
  // next one to disappear. Failing that, anyone left, so the crown is never
  // dropped on the floor while there is still a room to run.
  const watching = new Set([...room.listeners].map((l) => l.playerId));
  room.hostId = (others.find((p) => watching.has(p.id)) ?? others[0])?.id ?? null;
}

/**
 * A phone saying it is done, rather than just going quiet.
 *
 * In the lobby that takes the player out of the roster, which is what the
 * table expects to see. Mid-game it does not: the cards are dealt and the
 * rules have no way to un-deal one, so the player stays in the game and only
 * their phone is forgotten. Either way the crown moves if it was theirs.
 */
export function leaveRoom(room, playerId) {
  if (!playerById(room.state, playerId)) return room.state;
  const wasHost = room.hostId === playerId;

  if (room.state.phase === PHASE.LOBBY && room.state.players.length > 1) {
    room.state = reduce(room.state, { type: 'REMOVE_PLAYER', playerId });
  }
  forgetPlayer(room, playerId);
  if (wasHost) passHost(room, playerId);

  room.touchedAt = Date.now();
  store.save(rooms);
  broadcast(room);
  return room.state;
}

/** Actions only the host may take. */
const HOST_ONLY = new Set([
  'SET_CONFIG',
  'START_GAME',
  'FORCE_VOTE',
  'CONTINUE',
  'PLAY_AGAIN',
  'RESET',
  'REMOVE_PLAYER',
  'DECLARE_ELIMINATION',
  // Wiping the night's score is not something a guest gets to do on a whim.
  'CLEAR_SCORES',
  // The reducer's own comment says this one is "sent by whoever is hosting,
  // from their own phone", and the online screen only sends it when isHost —
  // but an assumption on the client is not a rule. Without it here any guest
  // could POST a SET_CUSTOM_PACKS of their own and replace the word list the
  // table spent the evening writing, or empty it.
  'SET_CUSTOM_PACKS',
]);

/**
 * Apply an action on behalf of `playerId`, rewriting the actor fields so a
 * client can only ever act as itself.
 */
export function dispatch(room, playerId, action) {
  if (!playerId) throw new GameError('notInRoom');

  if (HOST_ONLY.has(action.type) && playerId !== room.hostId)
    throw new GameError('hostOnly');

  let scoped = action;
  switch (action.type) {
    case 'MARK_REVEALED':
      scoped = { ...action, playerId };
      break;
    case 'SUBMIT_CLUE':
      scoped = { ...action, playerId };
      break;
    case 'CAST_VOTE':
      scoped = { ...action, voterId: playerId };
      break;
    case 'CALL_WORD':
      scoped = { ...action, playerId };
      break;
    case 'STEAL_GUESS':
      // The final guess belongs to the player who was just voted out, not to
      // any imposter who fancies a go.
      if (room.state.phase !== PHASE.STEAL) throw new GameError('notSteal');
      if (room.state.stealBy !== playerId) throw new GameError('notImposter');
      scoped = { ...action, playerId };
      break;
    case 'REMOVE_PLAYER':
      if (action.playerId === room.hostId) throw new GameError('cannotRemoveHost');
      break;
    default:
      break;
  }

  room.state = reduce(room.state, scoped);
  // A kicked player is gone from the game; their phone has to go with them.
  if (action.type === 'REMOVE_PLAYER') forgetPlayer(room, action.playerId);
  room.touchedAt = Date.now();
  store.save(rooms);
  broadcast(room);
  return room.state;
}

/* ------------------------------------------------------------------ *
 * What each connected phone is allowed to see
 * ------------------------------------------------------------------ */

/**
 * Whether this phone is the host.
 *
 * Written out rather than inlined because the obvious `playerId ===
 * room.hostId` says yes to nobody: a brand-new room has no host, a phone with
 * no valid token has no id, and `null === null` is true. That put host
 * buttons on the screen of anyone who opened a room URL without a token.
 * They could not actually use them — every action is checked against the
 * token on the way in — but being shown the controls for a game you are not
 * in is its own kind of wrong.
 */
const isHostPhone = (room, playerId) => playerId != null && playerId === room.hostId;

export function payloadFor(room, playerId) {
  const state = room.state;
  const inGame = state.phase !== PHASE.LOBBY && playerById(state, playerId);
  return {
    code: room.code,
    hostId: room.hostId,
    you: playerId,
    isHost: isHostPhone(room, playerId),
    state: publicState(state),
    private: inGame ? viewFor(state, playerId) : null,
  };
}

/**
 * The same payload, as text, over one shared copy of the shared half.
 *
 * Almost all of what goes to a phone is what goes to every other phone: 891
 * bytes of public state against about 134 bytes of private view. Building the
 * object per listener and handing each one to JSON.stringify serialised those
 * 891 bytes once per phone, every time anybody did anything — eight identical
 * passes over an identical object.
 *
 * So the shared half is serialised once and spliced in as text. Every value
 * that varies still goes through JSON.stringify, so nothing here is escaped
 * by hand; only the braces are. A test parses the result back and compares it
 * with `payloadFor` above, because the day those two disagree is the day a
 * phone is told something that is not true.
 */
function payloadText(room, playerId, sharedStateJson) {
  const state = room.state;
  const inGame = state.phase !== PHASE.LOBBY && playerById(state, playerId);
  const privateView = inGame ? viewFor(state, playerId) : null;
  return (
    `{"code":${JSON.stringify(room.code)},` +
    `"hostId":${JSON.stringify(room.hostId ?? null)},` +
    `"you":${JSON.stringify(playerId ?? null)},` +
    `"isHost":${isHostPhone(room, playerId)},` +
    `"state":${sharedStateJson},` +
    `"private":${JSON.stringify(privateView ?? null)}}`
  );
}

/** What everyone in this room is looking at, serialised once. */
const sharedJson = (room) => JSON.stringify(publicState(room.state));

export function addListener(room, playerId, send, close) {
  const listener = { playerId, send, close };
  room.listeners.add(listener);
  room.touchedAt = Date.now();
  // A socket can die between being accepted and being written to, and this
  // first write used to be the one place that was not guarded — so it threw
  // out of the request handler instead of just dropping the listener.
  try {
    send(payloadText(room, playerId, sharedJson(room)));
  } catch {
    room.listeners.delete(listener);
  }
  return () => room.listeners.delete(listener);
}

export function broadcast(room) {
  if (room.listeners.size === 0) return;
  // Once for the room, not once for the phone.
  const shared = sharedJson(room);
  for (const l of room.listeners) {
    try {
      l.send(payloadText(room, l.playerId, shared));
    } catch {
      room.listeners.delete(l);
    }
  }
}

/**
 * The text a single phone would be sent right now.
 *
 * For tests and the one-shot reconnect endpoint only. It serialises the
 * shared half for this one phone, which is the thing `broadcast` exists to
 * avoid — measured, it is slightly slower than building the object. Through
 * `broadcast` the saving is real and grows with the room: 1.8× at four
 * phones, 2.4× at eight.
 */
export function payloadTextFor(room, playerId) {
  return payloadText(room, playerId, sharedJson(room));
}
