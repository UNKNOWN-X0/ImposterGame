/**
 * The one line an imposter gets in hint mode.
 *
 * This had no test at all: it is reached through a .jsx barrel, so nothing
 * `node --test` can load ever imported it, and the coverage ratchet counted
 * it as a file no test loads rather than as a gap. Importing it directly is
 * all it takes — the file is plain JavaScript and always was.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import { hintLine } from './hintLine.js';
import { translate } from '../../i18n/translate.js';

/** The real translator, so the plural branch is checked against real text. */
const translator = (lang) => (key, params) => translate(lang, key, params);

test('no hint is no line', () => {
  assert.equal(hintLine(() => 'x', null), '');
  assert.equal(hintLine(() => 'x', undefined), '');
});

test('one word and many words take different sentences', () => {
  const seen = [];
  const t = (key, params) => {
    seen.push(key);
    return `${key}(${params.words},${params.chars})`;
  };
  hintLine(t, { words: 1, chars: 6 });
  hintLine(t, { words: 2, chars: 11 });
  hintLine(t, { words: 5, chars: 24 });
  assert.deepEqual(seen, ['hint.shapeOne', 'hint.shapeMany', 'hint.shapeMany']);
});

test('the category comes before the shape, and only when there is one', () => {
  const t = () => 'SHAPE';
  assert.equal(hintLine(t, { words: 1, chars: 4, text: 'An animal' }), 'An animal · SHAPE');
  assert.equal(hintLine(t, { words: 1, chars: 4, text: '' }), 'SHAPE');
  assert.equal(hintLine(t, { words: 1, chars: 4 }), 'SHAPE');
});

test('every language says both shapes, and fills both numbers', () => {
  for (const lang of ['en', 'th', 'de']) {
    const t = translator(lang);
    const one = hintLine(t, { words: 1, chars: 6 });
    const many = hintLine(t, { words: 3, chars: 14 });
    for (const [line, label] of [[one, 'singular'], [many, 'plural']]) {
      assert.ok(line, `${lang}: the ${label} line is empty`);
      assert.ok(!line.includes('{'), `${lang}: the ${label} line has an unfilled placeholder: ${line}`);
      assert.ok(!line.startsWith('hint.'), `${lang}: the ${label} line fell through to the key`);
    }
    assert.ok(one.includes('6'), `${lang}: the singular line lost the letter count`);
    assert.ok(many.includes('3') && many.includes('14'), `${lang}: the plural line lost a number`);
    assert.notEqual(one, many, `${lang}: one word and three words read identically`);
  }
});
