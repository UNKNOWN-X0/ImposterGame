/**
 * The scoring table, as a seam.
 *
 * The numbers themselves are the balance of the game and are checked by
 * playing games in engine.test.js. These check that the table is the only
 * place they live, so changing what a win pays is one line here and not a
 * hunt through the rules.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WIN_REASONS, WIN_POINTS, MAX_WIN_POINTS, pointsFor, paysTheEliminated } from './index.js';
import { STRINGS } from '../../i18n/strings/index.js';
import '../../testing/ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));

test('every ending says who won and what it pays', () => {
  for (const [reason, spec] of Object.entries(WIN_REASONS)) {
    assert.ok(['crew', 'imposters', 'jester'].includes(spec.winner), `${reason}: won by whom?`);
    assert.ok(Number.isInteger(spec.points) && spec.points > 0, `${reason}: pays what?`);
    assert.equal(typeof spec.paysTheEliminated, 'boolean', `${reason}: pays the voted-out?`);
  }
});

test('the crew are only paid if they are still in, and the imposters either way', () => {
  for (const [reason, spec] of Object.entries(WIN_REASONS)) {
    if (spec.winner === 'crew') {
      assert.equal(paysTheEliminated(reason), false, `${reason} should not pay the voted-out`);
    } else {
      assert.equal(paysTheEliminated(reason), true, `${reason} won regardless of being voted out`);
    }
  }
});

test('the bolder the road, the more it pays', () => {
  // Not a rule the code enforces, but the reason the table exists: if these
  // ever invert, the imposter has no reason to call and the crew no reason
  // to be careful.
  assert.ok(WIN_POINTS.called > WIN_POINTS.outnumbered, 'calling beats grinding it out');
  assert.ok(WIN_POINTS.outnumbered > WIN_POINTS.time, 'taking over beats the clock');
  assert.ok(WIN_POINTS.cleanSweep > WIN_POINTS.caught, 'a sweep beats a win that cost somebody');
  assert.equal(MAX_WIN_POINTS, Math.max(...Object.values(WIN_POINTS)));
});

test('an ending nobody registered still pays something rather than nothing', () => {
  assert.equal(pointsFor('invented'), 1);
  assert.equal(paysTheEliminated('invented'), true);
});

test('every ending has a sentence in every language', () => {
  for (const reason of Object.keys(WIN_REASONS)) {
    for (const lang of Object.keys(STRINGS)) {
      const keys = Object.keys(STRINGS[lang]).filter((k) => k.toLowerCase().includes(reason.toLowerCase()));
      assert.ok(keys.length > 0, `${lang} says nothing about winning by ${reason}`);
    }
  }
});

test('the numbers live here and nowhere else', () => {
  // A literal award in the rules is a second copy of the balance, which is
  // how two screens end up disagreeing about what a win was worth.
  const engine = readFileSync(path.join(here, '..', 'engine.js'), 'utf8');
  assert.ok(!/award\s*=\s*\d/.test(engine), 'the engine is hard-coding what a win pays');
  assert.ok(engine.includes('pointsFor('), 'the engine should ask the table');
});
