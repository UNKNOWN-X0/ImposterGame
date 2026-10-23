/**
 * The phase-to-screen map, and both modes answering to it.
 *
 * The bug this is here for: a phase is added to the engine, routed in the
 * mode the author was testing, and forgotten in the other one. The game then
 * works on one phone and shows a blank screen on everybody else's, and no
 * test notices, because nothing was ever wrong with the phase itself.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PHASE } from '../core/engine.js';
import { SCREEN_FOR_PHASE, SCREEN_NAMES, screenFor, renderPhase, isPlaying } from './screens.js';
import '../testing/ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODES = {
  'one phone': 'local/LocalGame.jsx',
  'a room': 'online/OnlineGame.jsx',
};

test('every phase the engine has is shown on some screen', () => {
  for (const phase of Object.values(PHASE)) {
    assert.ok(
      screenFor(phase),
      `the engine has a "${phase}" phase and nothing says which screen draws it`,
    );
  }
});

test('the map invents no phases of its own', () => {
  const real = new Set(Object.values(PHASE));
  for (const phase of Object.keys(SCREEN_FOR_PHASE)) {
    assert.ok(real.has(phase), `"${phase}" is routed to a screen but is not a phase`);
  }
});

test('both modes draw every screen there is', () => {
  for (const [mode, file] of Object.entries(MODES)) {
    const source = readFileSync(path.join(here, file), 'utf8');
    assert.ok(source.includes('renderPhase('), `${mode} is not using the shared map`);
    for (const name of SCREEN_NAMES) {
      assert.match(
        source,
        new RegExp(`[\\s{,]${name}:\\s*\\(`),
        `${mode} (${file}) has no "${name}" screen — a phase would draw nothing there`,
      );
    }
  }
});

test('a phase nobody has heard of draws nothing, rather than half a game', () => {
  assert.equal(screenFor('timewarp'), null);
  assert.equal(renderPhase('timewarp', { lobby: () => 'x' }), null);
});

test('renderPhase calls the screen the phase asks for, and only that one', () => {
  const drawn = [];
  const screens = Object.fromEntries(
    SCREEN_NAMES.map((name) => [name, () => (drawn.push(name), name)]),
  );
  assert.equal(renderPhase(PHASE.VOTE, screens), 'vote');
  assert.deepEqual(drawn, ['vote']);
});

test('a mode that has not drawn a screen yet renders nothing instead of throwing', () => {
  // Half a set is what a mode looks like while somebody is still writing it.
  assert.equal(renderPhase(PHASE.STEAL, { lobby: () => 'x' }), null);
});

test('a game in progress is every phase but the lobby and the end', () => {
  assert.equal(isPlaying(PHASE.LOBBY), false);
  assert.equal(isPlaying(PHASE.GAME_OVER), false);
  for (const phase of [PHASE.REVEAL, PHASE.CLUES, PHASE.VOTE, PHASE.VERDICT, PHASE.STEAL]) {
    assert.equal(isPlaying(phase), true, `${phase} is a game in progress`);
  }
});
