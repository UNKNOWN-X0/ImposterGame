/**
 * Stopping a game that is under way.
 */

import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';

/**
 * Quitting mid-game throws away a round everyone is in the middle of, so it
 * asks first — inline rather than as a modal, which keeps it reachable by
 * keyboard and screen reader without any focus trapping.
 */
export function EndGameButton({ onEnd }) {
  const { t } = useT();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button className="btn-link" onClick={() => setAsking(true)}>
        {t('quit.end')}
      </button>
    );
  }

  return (
    <div className="card stack tight">
      <b>{t('quit.title')}</b>
      <span className="hint">{t('quit.body')}</span>
      <div className="row">
        <button className="btn ghost grow" onClick={() => setAsking(false)}>
          {t('common.cancel')}
        </button>
        <button className="btn danger grow" onClick={onEnd}>
          {t('quit.confirm')}
        </button>
      </div>
    </div>
  );
}
