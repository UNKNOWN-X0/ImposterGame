/**
 * Clues are spoken out loud rather than typed — the phone keeps track of
 * whose turn it is, and offers an imposter the chance to call the word.
 */

import { useState } from 'react';
import { alivePlayers, isImposter, playerById, speakingOrder } from '../../../core/engine.js';
import { useT } from '../../../i18n/index.jsx';
import { PlayerList } from '../../../features/lobby/index.js';
import { CallButton, CallPanel, NotTheImposter, PassGate, Timer, TurnOrder, VoteGrid, roundLabel } from '../../../features/round/index.js';
import { PackChip } from '../../../features/packs/index.js';

/* ------------------------------------------------------------------ *
 * Talking — clues are spoken out loud, not typed
 * ------------------------------------------------------------------ */

export function Talking({ state, run }) {
  const { t } = useT();
  const order = speakingOrder(state);
  // null -> playing, 'who' -> picking who is calling, then that player's id
  const [calling, setCalling] = useState(null);

  if (calling === 'who') {
    return (
      <div className="stack">
        <div className="stack tight">
          <h1 className="title">{t('call.who')}</h1>
          <p className="subtitle">{t('call.sub')}</p>
        </div>
        <VoteGrid players={alivePlayers(state)} onVote={(id) => setCalling(id)} />
        <button className="btn-link" onClick={() => setCalling(null)}>
          {t('call.back')}
        </button>
      </div>
    );
  }

  if (calling) {
    return (
      <CallOnOnePhone
        state={state}
        playerId={calling}
        onCall={(text) => run({ type: 'CALL_WORD', playerId: calling, text })}
        onCancel={() => setCalling(null)}
      />
    );
  }

  return (
    <div className="stack">
      <div className="stack tight">
        <div className="eyebrow row-eyebrow">
          {roundLabel(t, state.round, state.config.maxRounds)}
          <PackChip
            lang={state.config.wordLang}
            packId={state.packId}
            customPacks={state.customPacks}
          />
        </div>
        <h1 className="title">{t('clues.title')}</h1>
        <p className="subtitle">{state.round > 1 ? t('clues.oneMore') : t('clues.sub')}</p>
      </div>

      <div className="card stack tight">
        <div className="eyebrow">{t('clues.order')}</div>
        <TurnOrder order={order} players={state.players} current={order[0]} />
      </div>

      <Timer seconds={90} />

      {state.eliminated.length > 0 && (
        <div className="stack tight">
          <div className="eyebrow">{t('clues.alreadyOut')}</div>
          <PlayerList
            players={state.players.filter((p) => state.eliminated.includes(p.id))}
            eliminated={state.eliminated}
          />
        </div>
      )}

      <button className="btn primary block lg" onClick={() => run({ type: 'FORCE_VOTE' })}>
        {t('clues.everyoneSpoke')}
      </button>

      {state.config.allowCall && <CallButton onClick={() => setCalling('who')} />}
    </div>
  );
}

/**
 * Calling the word on a shared phone.
 *
 * Anyone can tap the button, so the phone has to be handed over behind a gate
 * before it says anything. A crew member who taps it is told nothing useful —
 * otherwise the error itself would reveal that they are crew.
 */
function CallOnOnePhone({ state, playerId, onCall, onCancel }) {
  const [holding, setHolding] = useState(false);
  const player = playerById(state, playerId);

  if (!holding) {
    return (
      <div className="stack">
        <PassGate name={player.name} onReady={() => setHolding(true)} />
        <button className="btn-link" onClick={onCancel}>
          ‹
        </button>
      </div>
    );
  }

  if (!isImposter(state, playerId)) return <NotTheImposter onBack={onCancel} />;

  return <CallPanel onCall={onCall} onCancel={onCancel} />;
}
