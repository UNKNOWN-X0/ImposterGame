/**
 * How many imposters, what they are holding, and whether they know.
 *
 * Blind mode reaches across to the card: a blank card or a hint would tell an
 * imposter exactly what they are the moment they looked, so those two are
 * locked while nobody is being told anything.
 */

import { DECOY, IMPOSTERS_AUTO, IMPOSTERS_RANDOM } from '../../../core/engine.js';
import { Info } from '../../../ui/primitives/Info.jsx';
import { OnOff, Segmented } from '../../../ui/primitives/Segmented.jsx';
import { imposterHint, TELLTALE } from './helpers.js';

export function HowMany({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  // What the deal will actually use. The cap moves — turning the sidekick on
  // takes a seat off the imposters' allowance — and a stored number above it
  // is clamped by `resolveImposterCount` on the way into the game. Showing
  // the raw setting instead left a row of buttons with none of them pressed,
  // so the panel said nothing about a choice the game had already made.
  const chosen =
    typeof config.imposterCount === 'number'
      ? Math.min(config.imposterCount, cap)
      : config.imposterCount;
  return (
    <div className="setting block">
      <div className="label">
        <b>
          {t('settings.imposters')} <Info text={t('tip.imposters')} />
        </b>
        <span>{imposterHint(t, chosen, seats, cap)}</span>
      </div>
      <Segmented wide>
        <button
          aria-pressed={config.imposterCount === IMPOSTERS_AUTO}
          disabled={disabled}
          onClick={() => onChange({ imposterCount: IMPOSTERS_AUTO })}
        >
          {t('settings.imposterAuto')}
        </button>
        {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            aria-pressed={chosen === n}
            disabled={disabled}
            onClick={() => onChange({ imposterCount: n })}
          >
            {n}
          </button>
        ))}
        <button
          aria-pressed={config.imposterCount === IMPOSTERS_RANDOM}
          disabled={disabled}
          onClick={() => onChange({ imposterCount: IMPOSTERS_RANDOM })}
          title={t('settings.impostersRandomHint')}
        >
          {t('settings.imposterRandom')}
        </button>
      </Segmented>
    </div>
  );
}

export function WhatTheySee({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting block">
      <div className="label">
        <b>
          {t('settings.sees')}{' '}
          <Info
            text={t('tip.seesLead')}
            lines={[
              [t('settings.blank'), t('settings.seesBlank')],
              [t('settings.related'), t('settings.seesRelated')],
              [t('settings.unrelated'), t('settings.seesUnrelated')],
              [t('settings.hint'), t('settings.seesHint')],
            ]}
          />
        </b>
        <span>
          {t(
            {
              [DECOY.BLANK]: 'settings.seesBlank',
              [DECOY.UNRELATED]: 'settings.seesUnrelated',
              [DECOY.HINT]: 'settings.seesHint',
            }[config.decoyMode] || 'settings.seesRelated',
          )}
        </span>
      </div>
      <Segmented wide>
        {[
          [DECOY.BLANK, 'settings.blank'],
          [DECOY.RELATED, 'settings.related'],
          [DECOY.UNRELATED, 'settings.unrelated'],
          [DECOY.HINT, 'settings.hint'],
        ].map(([mode, key]) => (
          <button
            key={mode}
            aria-pressed={config.decoyMode === mode}
            // A blank card, or one holding a hint instead of a word, would
            // tell the imposter who they are at a glance — the one thing
            // blind mode cannot allow.
            disabled={disabled || (blind && TELLTALE.includes(mode))}
            title={blind && TELLTALE.includes(mode) ? t('settings.lockedByBlind') : undefined}
            onClick={() => onChange({ decoyMode: mode })}
          >
            {t(key)}
          </button>
        ))}
      </Segmented>
    </div>
  );
}

export function WhetherTheyKnow({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting">
      <div className="label">
        <b>
          {t('settings.knows')}{' '}
          <Info
            text={t('tip.knowsLead')}
            lines={[
              [t('settings.knowsShow'), t('settings.knowsOn')],
              [t('settings.knowsHide'), t('settings.knowsOff')],
            ]}
          />
        </b>
        <span>{blind ? t('settings.knowsOff') : t('settings.knowsOn')}</span>
      </div>
      <Segmented>
        <button
          aria-pressed={!blind}
          disabled={disabled}
          onClick={() => onChange({ imposterKnows: true })}
        >
          {t('settings.knowsShow')}
        </button>
        <button
          aria-pressed={blind}
          disabled={disabled}
          onClick={() => onChange({ imposterKnows: false })}
        >
          {t('settings.knowsHide')}
        </button>
      </Segmented>
    </div>
  );
}
