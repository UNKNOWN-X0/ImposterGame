#!/usr/bin/env node
/**
 * The party server — zero dependencies, Node's built-ins only.
 *
 *   npm run party        build the site, then serve it on your wifi
 *   npm run serve        serve an already-built site
 *
 * It does two things:
 *   1. serves the built React app from dist/
 *   2. holds the game rooms, pushing every change to every phone over SSE
 *
 * Server-Sent Events rather than WebSockets on purpose: it is one-way push,
 * which is all a card game needs, it survives a phone locking and unlocking
 * because the browser reconnects on its own, and it needs no packages.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { GameError, MIN_PLAYERS } from '../src/core/engine.js';
import { loadAllWords } from '../src/content/words/index.js';
import { LIMITS, callerOf, sweepLimits } from './limits.js';
import {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  playerForToken,
  dispatch,
  payloadFor,
  addListener,
  sweepRooms,
  flushRooms,
  roomCount,
  CODE_LENGTH,
} from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
// Port 0 asks the operating system for a free port (used by isolated tests).
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // Not application/json: a phone deciding whether this is an app it can
  // install checks the type, and octet-stream is not an invitation.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ------------------------------------------------------------------ *
 * Tiny helpers
 * ------------------------------------------------------------------ */

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
};

/**
 * Refuse politely, and say when to come back.
 *
 * 429 with Retry-After is what a well-behaved client expects, and the code
 * travels like every other refusal so each phone can say it in its own
 * language.
 */
const tooMany = (res, waitMs) => {
  const seconds = Math.ceil(waitMs / 1000);
  res.writeHead(429, {
    'content-type': 'application/json; charset=utf-8',
    'retry-after': String(seconds),
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify({ error: 'tooMany', params: { seconds } }));
};

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new GameError('tooLarge'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new GameError('badJson'));
      }
    });
    req.on('error', reject);
  });
}

/** The address to read out to everyone else in the room. */
export function lanAddress(port = PORT) {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4 && !net.internal) return `http://${net.address}:${port}`;
    }
  }
  return `http://localhost:${port}`;
}

/* ------------------------------------------------------------------ *
 * Static files
 * ------------------------------------------------------------------ */

function serveStatic(req, res, urlPath) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Not built yet</title>
       <style>font-family:system-ui;padding:2rem;line-height:1.6</style>
       <h1>The site has not been built yet</h1>
       <p>Run <code>npm run build</code> first, or use <code>npm run party</code>
          which does both.</p>`,
    );
    return;
  }

  // Resolve inside dist only — no climbing out with ../
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html'); // single-page app fallback
  }

  const ext = path.extname(file).toLowerCase();
  const immutable = rel.startsWith('assets/');
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ *
 * API
 * ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'rooms', CODE, ...]

  // POST /api/rooms  -> make a room and join it as host
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'rooms') {
    // The expensive one: every call mints a code and holds memory for hours.
    const wait = LIMITS.createRoom.check(callerOf(req));
    if (wait !== null) return tooMany(res, wait);
    const { name, wordLang } = await readBody(req);
    // The host's own interface language seeds the word language, which is
    // what the one-phone mode has always done. Validated in the engine, so
    // anything unrecognised simply falls back to the default.
    const room = createRoom(wordLang ? { wordLang } : {});
    const { player, token } = joinRoom(room, name);
    return json(res, 200, { code: room.code, token, playerId: player.id });
  }

  const code = parts[2];
  const room = code ? getRoom(code) : null;
  if (!room) return json(res, 404, { error: 'noSuchRoom' });

  // POST /api/rooms/:code/join
  if (req.method === 'POST' && parts[3] === 'join') {
    const wait = LIMITS.joinRoom.check(callerOf(req));
    if (wait !== null) return tooMany(res, wait);
    const { name } = await readBody(req);
    const { player, token } = joinRoom(room, name);
    return json(res, 200, { code: room.code, token, playerId: player.id });
  }

  // POST /api/rooms/:code/leave   { token }
  //
  // A phone saying so, rather than the server guessing from a dropped socket
  // — which it cannot tell from a locked screen or a walk out of wifi range.
  // Deliberately idempotent: a token the room has already forgotten is a
  // phone that has already left, which is the state the caller wanted.
  if (req.method === 'POST' && parts[3] === 'leave') {
    const { token } = await readBody(req);
    const player = playerForToken(room, token);
    if (player) leaveRoom(room, player.id);
    return json(res, 200, { ok: true });
  }

  // POST /api/rooms/:code/action   { token, action }
  if (req.method === 'POST' && parts[3] === 'action') {
    const { token, action } = await readBody(req);
    const player = playerForToken(room, token);
    if (!player) return json(res, 401, { error: 'staleToken' });
    // Per token rather than per address: everybody at a table is on one
    // wifi and would otherwise be sharing one allowance.
    const wait = LIMITS.action.check(`${room.code}:${token}`);
    if (wait !== null) return tooMany(res, wait);
    dispatch(room, player.id, action || {});
    return json(res, 200, { ok: true });
  }

  // GET /api/rooms/:code/stream?token=...   (Server-Sent Events)
  if (req.method === 'GET' && parts[3] === 'stream') {
    const token = url.searchParams.get('token');
    const player = playerForToken(room, token);
    if (!player) return json(res, 401, { error: 'unknownPlayer' });

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write(': connected\n\n');

    // Already JSON: the room serialised the half everybody shares exactly
    // once, rather than once per phone listening to it.
    const send = (payloadText) => res.write(`data: ${payloadText}\n\n`);
    const remove = addListener(room, player.id, send, () => res.end());

    // Comment frames keep phones and any middlebox from dropping the socket.
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      remove();
    });
    return undefined;
  }

  // GET /api/rooms/:code?token=...  (one-shot state, used on reconnect)
  if (req.method === 'GET' && parts.length === 3) {
    const player = playerForToken(room, url.searchParams.get('token'));
    return json(res, 200, payloadFor(room, player?.id ?? null));
  }

  return json(res, 404, { error: 'unknown' });
}

/* ------------------------------------------------------------------ *
 * Server
 * ------------------------------------------------------------------ */

/**
 * The words, loaded once, whoever started the server.
 *
 * This used to live only in the `isMain` branch below, which meant anybody
 * who imported `createServer` got a server that served the site perfectly
 * and then failed every deal with "no word packs" — the browser sweeps in
 * src/testing/browser do exactly that, which is part of why no room screen
 * was ever swept. The server is the one that deals, so it needs the words
 * before it answers anything, and it should not be the caller's job to
 * remember. They are files on the same disk, not a download.
 */
let words = null;
const wordsLoaded = () => (words ??= loadAllWords());

export function createServer() {
  // Start the read now rather than on the first request, so a server that is
  // listening is a server that is nearly ready.
  wordsLoaded();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      // Only the API can deal; static files need nothing and should not wait.
      if (url.pathname.startsWith('/api/')) await wordsLoaded();
      if (url.pathname === '/api/health') {
        return json(res, 200, {
          ok: true,
          rooms: roomCount(),
          minPlayers: MIN_PLAYERS,
          // The join box has to accept whatever this server hands out: a
          // deployment on the open internet may be using longer codes.
          codeLength: CODE_LENGTH,
        });
      }
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res, url.pathname === '/' ? '/index.html' : url.pathname);
    } catch (err) {
      if (err instanceof GameError)
        return json(res, 400, { error: err.code, params: err.params });
      console.error(err);
      if (!res.headersSent) return json(res, 500, { error: 'unknown' });
      return res.end();
    }
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const server = createServer();
  // Nothing is served until the words are in: a room whose host picks Thai
  // cannot be waiting on a fetch at the moment the cards go out.
  await wordsLoaded();

  const sweeper = setInterval(() => {
    sweepRooms();
    // Same broom: without this the limit tables grow by one entry per
    // address that ever visited, which is the shape of problem they exist
    // to prevent.
    sweepLimits();
  }, 10 * 60 * 1000);
  sweeper.unref?.();

  server.listen(PORT, '0.0.0.0', () => {
    const port = server.address().port;
    const addr = lanAddress(port);
    console.log('');
    console.log('  🕵️  Imposter is running');
    console.log('');
    console.log(`  On this computer:  http://localhost:${port}`);
    console.log(`  On everyone else's phone:  ${addr}`);
    console.log('');
    console.log('  Same wifi, then open that address and join with the room code.');
    console.log('  Ctrl-C to stop.');
    console.log('');
  });

  // On the way out, write down whatever is still owed. A deploy sends
  // SIGTERM and gives a process a few seconds; that is plenty for one small
  // file, and it is the difference between a table waiting ten seconds and a
  // table losing the round.
  const bye = () => {
    flushRooms();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}
