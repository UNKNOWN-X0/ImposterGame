/**
 * Three ways a table usually wants to play, as one row of buttons.
 *
 * It sits above the ten sections rather than replacing them: tapping one
 * sets several of them at once, and changing anything afterwards simply
 * leaves the row showing "Yours". Nothing is hidden and nothing is locked —
 * somebody who wants to read every section still can.
 */

import { Segmented } from '../../../ui/primitives/index.js';
import { PRESETS, presetFor } from '../presets.js';

export function Presets({ t, config, onChange, disabled }) {
  const current = presetFor(config);

  return (
    <div className="setting">
      <div className="setting-head">
        <span>{t('settings.preset')}</span>
      </div>
      <Segmented wide>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            aria-pressed={current === preset.id}
            disabled={disabled}
            onClick={() => onChange({ ...preset.config })}
          >
            {t(`settings.preset.${preset.id}`)}
          </button>
        ))}
        {/* Not a choice anybody makes — it is what the row says when the
            settings below have stopped matching any of the three. Pressing
            it would mean nothing, so it does not respond. */}
        <button aria-pressed={current === null} disabled>
          {t('settings.preset.custom')}
        </button>
      </Segmented>
      <p className="hint">
        {t(current ? `settings.preset.${current}Hint` : 'settings.preset.customHint')}
      </p>
    </div>
  );
}
