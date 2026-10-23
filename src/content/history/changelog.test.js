/**
 * The history the player reads.
 *
 * Three things can quietly go wrong with a changelog that lives in two files:
 * the app can claim a version it is not, a release can be added without its
 * sentences, and a translation can be forgotten. All three are cheap to check
 * and expensive to find out about from somebody holding a phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { RELEASES, VERSION, noteKey, hasNews, since } from './changelog.js';
import { STRINGS, LANGUAGES } from '../../i18n/strings/index.js';
import { translate } from '../../i18n/translate.js';
import '../../testing/ready.js';

const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url)));

test('the app says the version it actually is', () => {
  assert.equal(VERSION, pkg.version);
  assert.equal(RELEASES[0].v, pkg.version, 'the newest release is the current one');
});

test('CHANGELOG.md and the in-app history agree about the latest release', () => {
  const md = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
  const headings = [...md.matchAll(/^## \[([\d.]+)\] — (\d{4}-\d{2}-\d{2})$/gm)];
  assert.ok(headings.length > 0, 'no releases found in CHANGELOG.md');
  assert.equal(headings[0][1], VERSION, 'CHANGELOG.md leads with a different version');
  assert.equal(headings[0][2], RELEASES[0].date, 'the two disagree about the date');
});

test('versions run newest first, once each', () => {
  const seen = new Set();
  let previous = null;
  for (const release of RELEASES) {
    assert.ok(!seen.has(release.v), `${release.v} is listed twice`);
    seen.add(release.v);
    assert.match(release.v, /^\d+\.\d+\.\d+$/, `${release.v} is not a version`);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/, `${release.v} has no real date`);
    if (previous) {
      assert.ok(order(previous) > order(release.v), `${previous} should come after ${release.v}`);
    }
    previous = release.v;
    assert.ok(release.notes.length > 0, `${release.v} says nothing`);
  }
});

const order = (v) => v.split('.').reduce((n, part) => n * 1000 + Number(part), 0);

test('every note has a sentence in every language', () => {
  for (const release of RELEASES) {
    for (const note of release.notes) {
      const key = noteKey(release.v, note);
      for (const { id } of LANGUAGES) {
        const text = translate(id, key);
        assert.notEqual(text, key, `${id} has nothing for ${key}`);
        assert.ok(text.length > 10, `${id}: ${key} is too short to be a sentence`);
      }
    }
  }
});

test('no note is left over from a release that was removed', () => {
  const live = new Set(RELEASES.flatMap((r) => r.notes.map((n) => noteKey(r.v, n))));
  const stale = Object.keys(STRINGS.en).filter((k) => k.startsWith('log.1') && !live.has(k));
  assert.deepEqual(stale, [], 'these strings belong to no release');
});

test('the screens that carry the history are translated too', () => {
  const keys = ['log.title', 'log.sub', 'log.current', 'log.new', 'log.earlier_other'];
  for (const key of keys) {
    for (const { id } of LANGUAGES) {
      assert.notEqual(translate(id, key), key, `${id} has nothing for ${key}`);
    }
  }
});

test('a first visit has missed nothing', () => {
  assert.equal(hasNews(null), false);
  assert.equal(hasNews(''), false);
  assert.deepEqual(since(null), []);
});

test('a player who has seen this version is not told there is news', () => {
  assert.equal(hasNews(VERSION), false);
  assert.deepEqual(since(VERSION), []);
});

test('a player coming back from an older version is told what they missed', () => {
  const older = RELEASES[3].v;
  assert.equal(hasNews(older), true);
  const missed = since(older);
  assert.equal(missed.length, 3);
  assert.equal(missed[0].v, VERSION, 'newest first');
  assert.ok(!missed.some((r) => r.v === older), 'the version they had is not news');
});

test('a version we have never heard of is treated as a fresh start', () => {
  // A build from a branch, or a downgrade: better to show the history than
  // to decide there is nothing to say.
  assert.equal(hasNews('0.0.1'), true);
  assert.equal(since('0.0.1').length, RELEASES.length);
});
