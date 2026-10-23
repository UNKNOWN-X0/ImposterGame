/**
 * The two ways an imposter can take it outright, and how long the crew have.
 */

import { ROUNDS_UNLIMITED } from '../../../core/engine.js';
import { Info } from '../../../ui/primitives/Info.jsx';
import { OnOff, Segmented } from '../../../ui/primitives/Segmented.jsx';

export function Calling({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting">
      <div className="label">
        <b>
          {t('settings.call')} <Info text={t('tip.call')} />
        </b>
        <span>{blind ? t('settings.lockedByBlind') : t('settings.callHint')}</span>
      </div>
      <OnOff
        value={config.allowCall}
        disabled={disabled || blind}
        onChange={(v) => onChange({ allowCall: v })}
      />
    </div>
  );
}

export function Stealing({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting">
      <div className="label">
        <b>
          {t('settings.steal')} <Info text={t('tip.steal')} />
        </b>
        <span>{t('settings.stealHint')}</span>
      </div>
      <OnOff
        value={config.allowSteal}
        disabled={disabled}
        onChange={(v) => onChange({ allowSteal: v })}
      />
    </div>
  );
}

export function Rounds({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting block">
      <div className="label">
        <b>
          {t('settings.rounds')} <Info text={t('tip.rounds')} />
        </b>
        <span>
          {config.maxRounds === ROUNDS_UNLIMITED
            ? t('settings.roundsUnlimitedHint')
            : t('settings.roundsHint')}
        </span>
      </div>
      <Segmented wide>
        {[2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-pressed={config.maxRounds === n}
            disabled={disabled}
            onClick={() => onChange({ maxRounds: n })}
          >
            {n}
          </button>
        ))}
        <button
          aria-pressed={config.maxRounds === ROUNDS_UNLIMITED}
          disabled={disabled}
          onClick={() => onChange({ maxRounds: ROUNDS_UNLIMITED })}
          title={t('settings.roundsUnlimitedHint')}
        >
          {t('settings.roundsUnlimited')}
        </button>
      </Segmented>
    </div>
  );
}
