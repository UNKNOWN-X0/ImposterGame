/**
 * A voted-out imposter's last word.
 */

import { playerById } from '../../../core/engine.js';
import { useT } from '../../../i18n/index.jsx';
import { PassGate, StealCard } from '../../../features/round/index.js';

/* ------------------------------------------------------------------ *
 * Steal
 * ------------------------------------------------------------------ */

export function Steal({ state, run, holding, setHolding }) {
  const { t } = useT();
  // The guess belongs to whoever was just voted out, not to the imposters as
  // a group — and in blind mode that player has only now found out.
  const names = [playerById(state, state.stealBy)?.name].filter(Boolean);

  if (!holding) {
    return (
      <div className="stack">
        <div className="stack tight center">
          <div className="eyebrow">{t('steal.caught')}</div>
          <h1 className="title">{t('steal.waitTitle')}</h1>
        </div>
        <PassGate
          name={names.join(' & ')}
          onReady={() => setHolding(true)}
          note={t('steal.passTo')}
        />
      </div>
    );
  }

  return <StealCard canGuess onGuess={(text) => run({ type: 'STEAL_GUESS', text })} />;
}
