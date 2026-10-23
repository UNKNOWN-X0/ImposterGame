/**
 * A crash report, and the one thing it must never contain.
 *
 * A report gets pasted into the group chat that the other players are
 * reading. If the word can reach it, the round is over — and a bug report is
 * a terrible way to lose a game. So most of this file is one rule, checked
 * from several directions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, reportText, redact, REDACTED } from './report.js';
import {
  note,
  keepQuiet,
  describe as describeApp,
  described,
  record,
  forget,
  trail,
  failuresSoFar,
  onFailure,
  watchTheWindow,
} from './log.js';
import { aGame } from '../../testing/game.js';
import { PHASE, GameError } from '../../core/engine.js';
import '../../testing/ready.js';

test.beforeEach(() => forget());

/* ---------------------------------------------------------------- *
 * The rule
 * ---------------------------------------------------------------- */

test('the word is taken out of everything a report carries', () => {
  const error = new Error('could not render "Pad thai" in <RoleCard>');
  error.stack = 'Error: could not render "Pad thai"\n  at RoleCard (word: Pad thai)';
  const report = buildReport(error, {
    where: 'rendering Pad thai',
    secrets: ['Pad thai', 'Pad see ew'],
  });
  const text = reportText(report);
  assert.ok(!text.includes('Pad thai'), 'the word survived into the report');
  assert.ok(!text.includes('Pad see ew'), 'so did the near miss');
  assert.ok(text.includes(REDACTED), 'and it did not say that anything was removed');
});

test('it is taken out however it was written down', () => {
  for (const written of ['Pad Thai', 'PAD THAI', 'pad thai', 'Pad  thai', 'Pad\nthai']) {
    const out = redact(`crashed on ${written} here`, ['Pad thai']);
    assert.ok(!/pad\s*thai/i.test(out), `"${written}" got through`);
  }
});

test('a secret of one character is ignored, and two is not', () => {
  // A one-letter secret would turn a report into dots for no gain. From two
  // characters up the trade goes the other way: Thai words are short, and a
  // harder-to-read report is a far smaller loss than a word reaching the room.
  assert.equal(redact('a plain sentence', ['a', '', '  ']), 'a plain sentence');
  assert.equal(redact('the word was ไก่', ['ไก่']), `the word was ${REDACTED}`);
});

test('one secret inside another is removed whole', () => {
  // "Fried rice" contains "rice": the longer one has to go first or half of
  // it is left sitting in the report.
  const out = redact('the word was Fried rice', ['rice', 'Fried rice']);
  assert.ok(!out.includes('rice'), `left something behind: ${out}`);
});

test('a real game hands the reporter its real secrets, and they do not come back', () => {
  const state = aGame({ players: 6, phase: PHASE.CLUES, seed: 12 });
  keepQuiet([state.secretWord, state.imposterWord].filter(Boolean));
  const report = record(new Error(`boom while showing ${state.secretWord}`), { where: 'render' });
  const text = reportText(report);
  assert.ok(state.secretWord, 'the fixture should have dealt a word');
  assert.ok(!text.includes(state.secretWord), `the word "${state.secretWord}" is in the report`);
  if (state.imposterWord) assert.ok(!text.includes(state.imposterWord));
});

test('what a report says about the game gives nothing away', () => {
  const state = aGame({ players: 6, phase: PHASE.VOTE, seed: 3 });
  keepQuiet([state.secretWord, state.imposterWord].filter(Boolean));
  describeApp({
    version: '9.9.9',
    lang: 'th',
    wordLang: state.config.wordLang,
    mode: 'one phone',
    phase: state.phase,
    players: state.players.length,
  });
  const text = reportText(record(new Error('nope'), { where: 'promise' }));
  assert.ok(text.includes('9.9.9') && text.includes('vote') && text.includes('6'));
  // Where it broke and what was being played are different questions, and
  // neither may hide the other.
  assert.match(text, /where\s+promise/);
  assert.match(text, /mode\s+one phone/);
  // Who is who is not in there at all.
  for (const id of state.imposterIds) assert.ok(!text.includes(id), 'an imposter id leaked');
  for (const player of state.players) {
    assert.ok(!new RegExp(`\\b${player.name}\\b`).test(text), `${player.name} is named`);
  }
});

/* ---------------------------------------------------------------- *
 * The trail
 * ---------------------------------------------------------------- */

test('the trail is names of actions and nothing else', () => {
  note('ADD_PLAYER');
  note('START_GAME');
  note('SUBMIT_CLUE');
  const report = record(new Error('x'));
  assert.deepEqual(report.breadcrumbs, ['ADD_PLAYER', 'START_GAME', 'SUBMIT_CLUE']);
  assert.ok(reportText(report).includes('ADD_PLAYER → START_GAME → SUBMIT_CLUE'));
});

test('the trail stops growing', () => {
  for (let i = 0; i < 100; i += 1) note(`STEP_${i}`);
  assert.ok(trail().length <= 12, `kept ${trail().length}`);
  assert.equal(trail().at(-1), 'STEP_99', 'and keeps the most recent');
});

test('ending a game forgets what was secret', () => {
  keepQuiet(['Pad thai']);
  forget();
  const text = reportText(record(new Error('the word was Pad thai')));
  assert.ok(text.includes('Pad thai'), 'nothing is secret once nothing is secret');
});

/* ---------------------------------------------------------------- *
 * Reporting is not allowed to make things worse
 * ---------------------------------------------------------------- */

test('a rule violation reports as its code, not as a sentence', () => {
  const report = record(new GameError('clueTaken', { text: 'sushi' }));
  assert.equal(report.error.code, 'clueTaken');
  assert.ok(reportText(report).includes('clueTaken'));
});

test('anything can be thrown at it', () => {
  for (const thing of [null, undefined, 'a string', 42, { message: 'object' }, new Error()]) {
    const report = record(thing);
    assert.ok(report.error, `nothing came back for ${String(thing)}`);
    assert.equal(typeof reportText(report), 'string');
  }
});

test('what each part knows is added to what the others know', () => {
  // Startup knows the version, the language picker knows the language, a
  // running game knows the phase. None of them knows the others, so none of
  // them may erase the others.
  describeApp({ version: '9.9.9' });
  describeApp({ lang: 'th' });
  describeApp({ mode: 'one phone', phase: 'vote' });
  const text = reportText(record(new Error('x')));
  for (const fact of ['9.9.9', 'th', 'one phone', 'vote']) {
    assert.ok(text.includes(fact), `the report forgot ${fact}`);
  }
});

test('a game that ends stops being described', () => {
  describeApp({ version: '9.9.9', mode: 'one phone', phase: 'clues', players: 6 });
  describeApp({ mode: null, phase: null, players: null });
  assert.deepEqual(described(), { version: '9.9.9' });
  const text = reportText(record(new Error('back on the home screen')));
  assert.ok(!text.includes('clues'), 'a report from the home screen still claims a round');
  assert.ok(text.includes('9.9.9'), 'and it forgot the version while it was at it');
});

test('a listener that throws does not take the page with it', () => {
  const seen = [];
  onFailure(() => {
    throw new Error('bad listener');
  });
  onFailure((r) => seen.push(r));
  record(new Error('still reported'));
  assert.equal(seen.length, 1, 'the second listener never heard about it');
});

test('only the last few failures are kept', () => {
  for (let i = 0; i < 20; i += 1) record(new Error(`failure ${i}`));
  const kept = failuresSoFar();
  assert.ok(kept.length <= 5, `kept ${kept.length}`);
  assert.ok(kept.at(-1).error.message.includes('19'));
});

test('the window is watched, and can be unwatched', () => {
  const handlers = {};
  const fake = {
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
    removeEventListener: (name) => {
      delete handlers[name];
    },
  };
  const stop = watchTheWindow(fake);
  assert.ok(handlers.error && handlers.unhandledrejection, 'not listening');
  handlers.error({ error: new Error('from an event handler') });
  handlers.unhandledrejection({ reason: new Error('from a promise') });
  const kept = failuresSoFar();
  assert.equal(kept.length, 2);
  assert.equal(kept[0].where, 'window');
  assert.equal(kept[1].where, 'promise');
  stop();
  assert.deepEqual(Object.keys(handlers), [], 'still listening after being told to stop');
});

test('with no window there is nothing to watch and nothing to fail', () => {
  assert.equal(typeof watchTheWindow(null), 'function');
});
