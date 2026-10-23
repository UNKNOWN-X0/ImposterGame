/**
 * The role registry, as a seam.
 *
 * These are not tests of the detective or the jester — engine.test.js plays
 * whole games for that. These check that the registry is the only thing the
 * engine consults, so that adding a role really is one file: register one
 * here that this build has never heard of, and watch the rules pick it up.
 */

import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { ROLES, ROLE, SPECIAL_ROLES, roleSpec, endingFor, winsWithImposters } from './index.js';
import { createGame, reduce } from '../engine.js';
import { STRINGS } from '../../i18n/strings/index.js';
import '../../testing/ready.js';

test('every role is a complete description of itself', () => {
  for (const role of ROLES) {
    assert.match(role.id, /^[a-z]+$/, 'an id the settings can store');
    assert.ok(['crew', 'imposters', 'nobody'].includes(role.side), `${role.id}: which side?`);
    if (role.deal) assert.equal(typeof role.deal, 'function');
    if (role.endsGameWhenVotedOut) {
      assert.ok(role.endsGameWhenVotedOut.winner, `${role.id}: won by whom?`);
      assert.ok(role.endsGameWhenVotedOut.reason, `${role.id}: and called what?`);
    }
  }
});

test('the ids are unique, and SPECIAL_ROLES is exactly them', () => {
  const ids = ROLES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(SPECIAL_ROLES, ids, 'the settings list and the registry cannot disagree');
});

test('every role has a name and an explanation in every language', () => {
  for (const id of SPECIAL_ROLES) {
    for (const lang of Object.keys(STRINGS)) {
      assert.ok(STRINGS[lang][`role.${id}`], `${lang} has no name for ${id}`);
    }
    assert.ok(STRINGS.en[`role.${id}Tip`], `no explanation for ${id}`);
  }
});

test('plain crew and the imposter are not registered roles', () => {
  // They are what you are when nothing else was dealt, which is why they are
  // not in the registry and cannot be switched off.
  assert.equal(roleSpec(ROLE.CREW), null);
  assert.equal(roleSpec(ROLE.IMPOSTER), null);
  assert.equal(roleSpec('nonsense'), null);
  assert.equal(winsWithImposters(ROLE.CREW), false);
  assert.equal(endingFor(ROLE.CREW), null);
});

test('the rules never name a role', () => {
  // This is the whole point of the registry: if the engine knows the word
  // "jester", then adding a role means editing the engine, and the next one
  // after that means editing it again. The rules should only know that some
  // roles win with the imposters and some end the game when voted out.
  const rules = ['engine.js', 'rules.js', 'select.js', 'deal.js']
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
    .join('\n');
  for (const id of SPECIAL_ROLES) {
    assert.ok(
      !new RegExp(`\\b${id}\\b`, 'i').test(rules.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')),
      `the rules mention "${id}" — it should be asking the registry instead`,
    );
  }
});

test('a role is described by its own file, not by the engine', () => {
  // Each of these is a fact the engine reads off the role rather than one it
  // was told: the sidekick wins with the imposters, the jester ends it.
  assert.equal(winsWithImposters(ROLE.SIDEKICK), true);
  assert.equal(winsWithImposters(ROLE.DETECTIVE), false);
  assert.deepEqual(endingFor(ROLE.JESTER), { winner: 'jester', reason: 'jester' });
  assert.equal(endingFor(ROLE.SIDEKICK), null);
  assert.equal(typeof roleSpec(ROLE.DETECTIVE).deal, 'function', 'the detective deals itself a name');
});

test('a role the table asks for but this build does not have is simply not dealt', () => {
  // A saved game, or a room opened by a newer version, can name a role that
  // is not here. That is a role fewer, not a broken game.
  let state = createGame({ roles: ['detective', 'timelord'] });
  assert.deepEqual(state.config.roles, ['detective'], 'the unknown one is dropped');
  for (const name of ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay']) {
    state = reduce(state, { type: 'ADD_PLAYER', name });
  }
  state = reduce(state, { type: 'START_GAME', seed: 7 });
  assert.ok(!Object.values(state.roles).includes('timelord'));
});
