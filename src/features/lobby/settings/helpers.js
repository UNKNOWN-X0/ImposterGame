/**
 * Two small things the settings need and nothing else does.
 */

import { DECOY, IMPOSTERS_AUTO, IMPOSTERS_RANDOM, autoImposterCount } from '../../../core/engine.js';

/** Decoy modes whose card would not look like everyone else's. */
export const TELLTALE = [DECOY.BLANK, DECOY.HINT];

/** The line under "How many imposters", which depends on who is at the table. */
export function imposterHint(t, setting, seats, cap) {
  if (setting === IMPOSTERS_RANDOM) return t('settings.impostersRandomHint');
  if (setting === IMPOSTERS_AUTO)
    return t('settings.impostersAutoHint', { count: autoImposterCount(seats) });
  return cap === 1 ? t('settings.impostersOne') : t('settings.impostersCap', { count: cap });
}
