/**
 * Packs that outlive the build that wrote them.
 *
 * A pack is written on a Friday and opened again in six months, on a version
 * of the game that has moved on. Until now nothing on a saved pack said which
 * shape it was in, so there was no way to change that shape later without
 * either guessing or quietly dropping what somebody spent an evening writing.
 *
 * These are the tests for the number that fixes that, and for the two places
 * it has to survive: the shelf in localStorage and a share code in a chat.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import {
  PACK_VERSION,
  buildPack,
  decodePack,
  encodePack,
  migratePack,
  validatePack,
} from './custom.js';
import { loadPacks, savePacks } from '../../features/packs/store.js';

const SOME_WORDS = 'Sushi, Sashimi\nRamen, Udon\nTempura\nMiso, Dashi\nGyoza, Shumai\nYakitori';

const aPack = () => buildPack({ name: 'Dinner', emoji: '🍜', lang: 'en', text: SOME_WORDS }).pack;

/* ------------------------------------------------------------------ *
 * The number itself
 * ------------------------------------------------------------------ */

test('a pack somebody writes is stamped with the shape it is in', () => {
  const pack = aPack();
  assert.equal(pack.v, PACK_VERSION);
  assert.equal(pack.name, 'Dinner');
  assert.equal(pack.pairs.length, 6);
});

test('a pack from before there were versions is read as version 1', () => {
  // What is on phones today: the original shape, with no number on it.
  const old = { ...aPack() };
  delete old.v;

  const migrated = migratePack(old);
  assert.equal(migrated.v, 1);
  assert.deepEqual(migrated.pairs, old.pairs, 'and nothing about it changed');

  const validated = validatePack(old);
  assert.equal(validated.v, PACK_VERSION);
  assert.equal(validated.pairs.length, 6, 'the words survived');
});

test('a pack from a newer build is read with the fields this one knows', () => {
  // Deliberately not refused. The name and the pairs are the fields that
  // carry the actual work and have been there since the beginning; throwing
  // away somebody's words because they opened an older build would be a
  // worse answer than ignoring a field we have not heard of.
  const future = { ...aPack(), v: 99, mood: 'sarcastic', pairs: aPack().pairs };
  const read = validatePack(future);
  assert.ok(read, 'it is still a pack');
  assert.equal(read.pairs.length, 6, 'with all its words');
  assert.equal(read.v, PACK_VERSION, 'read as the shape this build understands');
  assert.equal(read.mood, undefined, 'and the field we do not know is simply not carried');
});

test('nonsense is still nonsense, with or without a version on it', () => {
  for (const junk of [null, 42, 'pack', {}, { v: 1 }, { v: 1, name: 'x', pairs: [] }]) {
    assert.equal(validatePack(junk), null, JSON.stringify(junk));
  }
});

/* ------------------------------------------------------------------ *
 * The shelf
 * ------------------------------------------------------------------ */

function withStorage(initial, body) {
  const map = new Map(Object.entries(initial));
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return body(map);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

test('a shelf written by this build comes back', () => {
  withStorage({}, (map) => {
    savePacks([aPack()]);
    const written = JSON.parse(map.get('imposter.packs'));
    assert.equal(written.v, 2, 'the shelf says what shape it is in');
    assert.equal(written.packVersion, PACK_VERSION, 'and what shape its packs are in');

    const back = loadPacks();
    assert.equal(back.length, 1);
    assert.equal(back[0].name, 'Dinner');
    assert.equal(back[0].pairs.length, 6);
  });
});

test('a shelf written by an older build — a bare array — still comes back', () => {
  // This is what is actually on phones right now, and the whole point of
  // doing this before changing anything else.
  const old = [{ ...aPack() }];
  delete old[0].v;
  withStorage({ 'imposter.packs': JSON.stringify(old) }, () => {
    const back = loadPacks();
    assert.equal(back.length, 1, 'the pack survived the format change');
    assert.equal(back[0].pairs.length, 6);
    assert.equal(back[0].v, PACK_VERSION, 'and came forward to the current shape');
  });
});

test('a shelf that is neither shape is an empty shelf, not a crash', () => {
  for (const junk of ['null', '"packs"', '42', '{"nope":true}', 'not json']) {
    withStorage({ 'imposter.packs': junk }, () => {
      assert.deepEqual(loadPacks(), [], junk);
    });
  }
});

/* ------------------------------------------------------------------ *
 * A code in a chat
 * ------------------------------------------------------------------ */

test('a share code survives the round trip, version and all', () => {
  const pack = aPack();
  const back = decodePack(encodePack(pack));
  assert.ok(back);
  assert.equal(back.v, PACK_VERSION);
  assert.equal(back.name, pack.name);
  assert.deepEqual(back.pairs, pack.pairs);
});

test('a code from a format this build does not know is refused outright', () => {
  // Unlike a stored pack, a code is all or nothing: there is no half of a
  // base64 blob worth reading, so an unknown prefix is simply not a pack.
  const real = encodePack(aPack());
  assert.ok(decodePack(real), 'the real one still works');
  assert.equal(decodePack(real.replace(/^IMP1\./, 'IMP9.')), null);
  assert.equal(decodePack('hello'), null);
  assert.equal(decodePack(''), null);
});
