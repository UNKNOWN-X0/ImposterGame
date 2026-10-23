/**
 * One phone, one player at a time: hand it over, hold to look, hand it on.
 */

import { playerById, viewFor } from '../../../core/engine.js';
import { useT } from '../../../i18n/index.jsx';
import { PassGate, RoleCard } from '../../../features/round/index.js';

/* ------------------------------------------------------------------ *
 * Reveal — one player at a time
 * ------------------------------------------------------------------ */

export function Reveal({ state, run, holding, setHolding }) {
  const { t } = useT();
  const nextId = state.order.find((id) => !state.revealed.includes(id));
  const player = playerById(state, nextId);
  const left = state.players.length - state.revealed.length;

  if (!player) return null;

  if (!holding) {
    return (
      <div className="stack">
        <div className="stack tight">
          <div className="eyebrow">{t('reveal.cardsLeft', { count: left })}</div>
          <h1 className="title">{t('reveal.dealt')}</h1>
        </div>
        <PassGate name={player.name} onReady={() => setHolding(true)} />
        <p className="hint center">{t('reveal.privacy')}</p>
      </div>
    );
  }

  return (
    <RoleCard
      view={viewFor(state, player.id)}
      wordLang={state.config.wordLang}
      customPacks={state.customPacks}
      name={player.name}
      doneLabel={left === 1 ? t('reveal.start') : t('reveal.next')}
      onDone={() => {
        setHolding(false);
        run({ type: 'MARK_REVEALED', playerId: player.id });
      }}
    />
  );
}
