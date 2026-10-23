/**
 * Three ways a table usually wants to play.
 *
 * Ten sections is a lot to read before a first game, and most of it is a
 * choice between the same three evenings: get on with it, take it seriously,
 * or let everything loose at once. These are those three, as settings.
 *
 * What a preset is NOT is a new kind of state. It sets the same config the
 * panel sets, one SET_CONFIG with several keys in it, and the moment anybody
 * changes a section afterwards the game is simply on custom settings again.
 * Nothing is stored, nothing has to be migrated, and a preset that stops
 * matching a changed default stops being selected rather than being wrong.
 *
 * The word language and the packs are deliberately left alone: those belong
 * to the table, not to how hard they want the round to be.
 */

import { DECOY, IMPOSTERS_AUTO, IMPOSTERS_RANDOM, ROUNDS_UNLIMITED } from '../../core/engine.js';

/** The keys a preset decides. Anything not here is the table's own business. */
export const PRESET_KEYS = [
  'imposterCount',
  'decoyMode',
  'imposterKnows',
  'allowCall',
  'allowSteal',
  'maxRounds',
  'roles',
  'scoring',
];

export const PRESETS = [
  {
    id: 'quick',
    // Short rounds, a friendly card, and every way of ending it early left
    // switched on.
    config: {
      imposterCount: IMPOSTERS_AUTO,
      decoyMode: DECOY.RELATED,
      imposterKnows: true,
      allowCall: true,
      allowSteal: true,
      maxRounds: 2,
      roles: [],
      scoring: false,
    },
  },
  {
    id: 'careful',
    // Room to argue: more rounds, a harder card, and a score to play for.
    config: {
      imposterCount: IMPOSTERS_AUTO,
      decoyMode: DECOY.UNRELATED,
      imposterKnows: true,
      allowCall: true,
      allowSteal: true,
      maxRounds: 5,
      roles: ['detective'],
      scoring: true,
    },
  },
  {
    id: 'chaos',
    // Nobody is told anything, the count is hidden, and it runs until it
    // ends. Two of these follow from blind rather than being chosen: the
    // telltale cards are out, so the decoy is a near miss, and calling the
    // word is off, because an imposter who has not been told they are the
    // imposter has nothing to call. The engine enforces both; this agrees
    // with it rather than being quietly corrected, so the preset still
    // recognises itself afterwards.
    config: {
      imposterCount: IMPOSTERS_RANDOM,
      decoyMode: DECOY.RELATED,
      imposterKnows: false,
      allowCall: false,
      allowSteal: true,
      maxRounds: ROUNDS_UNLIMITED,
      roles: [],
      scoring: true,
    },
  },
];

const same = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])
    : a === b;

/**
 * Which preset this config is, if it is one.
 *
 * Only the keys a preset decides are compared, so a table that picked
 * "quick" and then changed the word language is still on quick.
 */
export function presetFor(config) {
  if (!config) return null;
  const match = PRESETS.find((preset) =>
    PRESET_KEYS.every((key) => same(preset.config[key], config[key])),
  );
  return match ? match.id : null;
}
