/**
 * The three ways a table usually wants to play.
 *
 * The risk with a preset is not that it is wrong, it is that it stops being
 * true: somebody changes a default or tightens a rule, the preset quietly
 * normalises into something else, and the row of buttons shows "Yours" on a
 * game the table just picked off the shelf. So every preset is dealt here,
 * and every one has to still recognise itself afterwards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../../testing/ready.js';

import { PRESETS, PRESET_KEYS, presetFor } from './presets.js';
import { DEFAULT_CONFIG, createGame, normaliseConfig, reduce } from '../../core/engine.js';
import { STRINGS } from '../../i18n/strings/index.js';

const TABLE = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay'];

const dealtWith = (config, seats = TABLE.length, seed = 5) => {
  let state = createGame({ wordLang: 'en', ...config });
  for (const name of TABLE.slice(0, seats)) state = reduce(state, { type: 'ADD_PLAYER', name });
  return reduce(state, { type: 'START_GAME', seed });
};

test('every preset survives the engine and still knows its own name', () => {
  // The one that matters. `chaos` failed this when it was written: blind
  // mode switches calling off, so the config that came back was not the
  // config that went in, and the row showed "Yours" immediately.
  for (const preset of PRESETS) {
    const normalised = normaliseConfig({ ...DEFAULT_CONFIG, ...preset.config });
    assert.equal(
      presetFor(normalised),
      preset.id,
      `${preset.id} does not recognise itself after normalisation`,
    );
  }
});

test('every preset deals a real game', () => {
  for (const preset of PRESETS) {
    for (const seats of [3, 4, 6]) {
      const state = dealtWith(preset.config, seats);
      assert.ok(state.secretWord, `${preset.id} at ${seats}: no word`);
      assert.ok(state.imposterIds.length >= 1, `${preset.id} at ${seats}: no imposter`);
      assert.ok(
        state.imposterIds.length * 2 < seats,
        `${preset.id} at ${seats}: imposters start at parity`,
      );
    }
  }
});

test('the presets are three different evenings, not three names for one', () => {
  const shapes = PRESETS.map((p) => JSON.stringify(PRESET_KEYS.map((k) => p.config[k])));
  assert.equal(new Set(shapes).size, PRESETS.length, 'two presets are the same settings');
});

test('changing anything afterwards means the table is on its own settings', () => {
  const quick = PRESETS.find((p) => p.id === 'quick');
  const config = normaliseConfig({ ...DEFAULT_CONFIG, ...quick.config });
  assert.equal(presetFor(config), 'quick');
  assert.equal(presetFor({ ...config, maxRounds: 3 }), null, 'a changed round count is custom');
  assert.equal(presetFor({ ...config, roles: ['jester'] }), null, 'so is a role');
});

test('but the word language and the packs are the table’s own business', () => {
  // A preset is about how hard the round is, not about which words.
  const quick = PRESETS.find((p) => p.id === 'quick');
  const config = normaliseConfig({ ...DEFAULT_CONFIG, ...quick.config });
  assert.equal(presetFor({ ...config, wordLang: 'th' }), 'quick');
  assert.equal(presetFor({ ...config, packIds: ['food'] }), 'quick');
});

test('a preset only sets the keys it is allowed to', () => {
  for (const preset of PRESETS) {
    const extra = Object.keys(preset.config).filter((key) => !PRESET_KEYS.includes(key));
    assert.deepEqual(extra, [], `${preset.id} reaches outside what a preset decides: ${extra}`);
  }
});

test('nothing and nonsense are not presets', () => {
  assert.equal(presetFor(null), null);
  assert.equal(presetFor({}), null);
  assert.equal(presetFor(DEFAULT_CONFIG), null, 'the defaults are deliberately not one of them');
});

test('every preset has a name and a line under it, in every language', () => {
  for (const preset of PRESETS) {
    for (const lang of Object.keys(STRINGS)) {
      assert.ok(STRINGS[lang][`settings.preset.${preset.id}`], `${lang} has no name for ${preset.id}`);
      assert.ok(
        STRINGS[lang][`settings.preset.${preset.id}Hint`],
        `${lang} does not say what ${preset.id} does`,
      );
    }
  }
});
