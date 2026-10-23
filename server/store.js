/**
 * Rooms, written down, so a restart does not end everybody's game.
 *
 * Rooms live in memory, which is right for what they are — a few hundred
 * bytes that matter for an hour. But "in memory" also means a deploy, a crash
 * or a laptop lid closing takes every game in progress with it, and the table
 * finds out when the next tap says the room does not exist. On a host that
 * restarts a process whenever it feels like it, that is not a rare event.
 *
 * So every change is written to one small JSON file, and a fresh process
 * reads it back. Two deliberate limits:
 *
 *  - Only rooms touched recently come back. A file left over from last week
 *    is not a game anybody is waiting for, and restoring it would hand out
 *    stale codes that somebody else could now be using.
 *  - Listeners are not saved and cannot be. An SSE connection dies with the
 *    process; what comes back is the room, and the phones reconnect to it on
 *    their own, which is what EventSource already does.
 *
 * Note what is in this file: the state includes the secret word. That is the
 * same machine that was holding it in memory a moment ago, so it is not a new
 * secret in a new place — but it is a secret at rest, so the file is written
 * owner-only and lives wherever ROOM_STORE says, defaulting beside the code.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSION } from '../src/content/history/changelog.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where the rooms are kept, worked out from the environment.
 *
 * A function rather than an inline expression so a test can ask what a given
 * setting would mean without re-importing this module — re-importing it to
 * change one constant is the sort of thing that quietly counts the file
 * twice in a coverage report.
 */
export function storePathFrom(env = process.env) {
  if (env.ROOM_STORE === 'off') return null; // keep nothing; a game dies with the process
  return env.ROOM_STORE || path.join(here, '..', '.rooms.json');
}

/** Where the rooms are kept. Set ROOM_STORE=off to keep none. */
export const STORE_PATH = storePathFrom();

/**
 * How stale a room may be and still be worth bringing back.
 *
 * An hour: long enough to cover a deploy, a crash loop or somebody closing a
 * laptop over dinner; short enough that a file left from yesterday does not
 * resurrect codes into a world that has moved on.
 */
const RESTORE_WITHIN_MS = Number(process.env.ROOM_RESTORE_MS) || 60 * 60 * 1000;

/** Writes are coalesced: a burst of votes is one write, not eight. */
const WRITE_DELAY_MS = Number(process.env.ROOM_WRITE_MS) || 250;

let pending = null;
let lastError = null;

/** A room as it goes to disk. Everything that is not a live socket. */
const toRecord = (room) => ({
  code: room.code,
  state: room.state,
  hostId: room.hostId,
  tokens: [...room.tokens.entries()],
  createdAt: room.createdAt,
  touchedAt: room.touchedAt,
});

/** And back again, with an empty set of listeners for the phones to fill. */
function fromRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (typeof record.code !== 'string' || !record.state) return null;
  if (!Number.isFinite(record.touchedAt)) return null;
  return {
    code: record.code,
    state: record.state,
    hostId: record.hostId ?? null,
    tokens: new Map(Array.isArray(record.tokens) ? record.tokens : []),
    listeners: new Set(),
    createdAt: record.createdAt ?? Date.now(),
    touchedAt: record.touchedAt,
  };
}

/**
 * Write now, atomically.
 *
 * Via a temporary file and a rename, because the alternative is a process
 * that dies mid-write leaving a half-written file, and a half-written file is
 * worse than none: it is the thing that makes the NEXT start fail too.
 */
export function saveNow(rooms) {
  if (!STORE_PATH) return false;
  try {
    const records = [...rooms.values()].map(toRecord);
    const tmp = `${STORE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ v: VERSION, savedAt: Date.now(), rooms: records }), {
      mode: 0o600,
    });
    fs.renameSync(tmp, STORE_PATH);
    lastError = null;
    return true;
  } catch (err) {
    // A server that cannot write its rooms down is still a server that can
    // run a party. Say so once and carry on.
    if (!lastError) console.warn(`[rooms] could not be saved: ${err.message}`);
    lastError = err;
    return false;
  }
}

/** Ask for a write; several asks in a row become one. */
export function save(rooms) {
  if (!STORE_PATH) return;
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    saveNow(rooms);
  }, WRITE_DELAY_MS);
  pending.unref?.();
}

/** Write anything still owed, right now. For shutdown. */
export function flush(rooms) {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  return saveNow(rooms);
}

/**
 * What was on disk, as rooms, newest first and nothing stale.
 * Anything unreadable is treated as nothing at all.
 */
export function load(now = Date.now()) {
  if (!STORE_PATH || !fs.existsSync(STORE_PATH)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (err) {
    console.warn(`[rooms] the saved rooms could not be read (${err.message}); starting empty`);
    return [];
  }
  // A game dealt by a different build is not a game this build understands.
  //
  // Every other saved thing in the project already asks this — a resumed
  // local round is dropped when `state.version` moves (modes/local/storage.js)
  // and the pack shelf migrates between its own versions — but the room file
  // did not, so a deploy that changed the shape of the state fed the old one
  // straight into the new reducer for up to an hour. That is the one moment
  // when it matters, and it was the one place not checking. Dropping these
  // rooms costs the tables a restart; restoring them could deal somebody two
  // roles.
  if (parsed?.v !== VERSION) {
    const count = Array.isArray(parsed?.rooms) ? parsed.rooms.length : 0;
    if (count) {
      console.warn(
        `[rooms] ${count} saved game(s) were written by version ${parsed?.v ?? 'unknown'}; ` +
          `this is ${VERSION}, so they are being left behind rather than guessed at`,
      );
    }
    return [];
  }
  const records = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
  return records
    .map(fromRecord)
    .filter((room) => room && now - room.touchedAt <= RESTORE_WITHIN_MS);
}

/** For tests. */
export function forget() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  try {
    if (STORE_PATH && fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  } catch {
    /* nothing to forget */
  }
}
