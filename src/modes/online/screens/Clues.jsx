/**
 * Clues typed rather than spoken, because everybody is reading their own
 * screen: the grid fills in as they arrive.
 */

import { useMemo, useState } from 'react';
import { useT } from '../../../i18n/index.jsx';
import { CallButton, CallPanel, ClueGrid, ClueInput, ClueList, TurnOrder, roundLabel } from '../../../features/round/index.js';
import { PackChip } from '../../../features/packs/index.js';

export function OnlineClues({ payload, act }) {
  const { t } = useT();
  const { state, you } = payload;
  const [calling, setCalling] = useState(false);

  // Only an imposter is ever shown the button, so no crew member can learn
  // anything by pressing it.
  const mayCall =
    state.config.allowCall &&
    payload.private?.role === 'imposter' &&
    !state.eliminated.includes(you);

  const order = useMemo(() => {
    const alive = state.order.filter((id) => !state.eliminated.includes(id));
    if (alive.length === 0) return [];
    const offset = (state.round - 1) % alive.length;
    return [...alive.slice(offset), ...alive.slice(0, offset)];
  }, [state.order, state.eliminated, state.round]);

  const thisRound = state.clues.filter((c) => c.round === state.round);
  const spoken = thisRound.map((c) => c.playerId);
  const turn = order.find((id) => !spoken.includes(id)) ?? null;
  const myTurn = turn === you;
  const turnName = state.players.find((p) => p.id === turn)?.name;

  if (calling) {
    return (
      <CallPanel
        onCall={(text) => {
          setCalling(false);
          act({ type: 'CALL_WORD', text });
        }}
        onCancel={() => setCalling(false)}
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
        <h1 className="title">
          {myTurn ? t('clues.yours') : t('clues.thinking', { name: turnName })}
        </h1>
        {state.round > 1 && <p className="subtitle">{t('clues.oneMore')}</p>}
        {payload.private?.word ? (
          <p className="subtitle">
            {t('clues.yourWord', { word: payload.private.word })}
          </p>
        ) : (
          <p className="subtitle">{t('clues.noWord')}</p>
        )}
      </div>

      <div className="card stack tight">
        <div className="eyebrow">{t('clues.order')}</div>
        <TurnOrder order={order} players={state.players} current={turn} done={spoken} />
      </div>

      {myTurn ? (
        <ClueInput onSubmit={(text) => act({ type: 'SUBMIT_CLUE', text })} />
      ) : (
        <p className="hint center dots">{t('clues.waitingFor', { name: turnName })}</p>
      )}

      {mayCall && <CallButton onClick={() => setCalling(true)} />}

      <div className="stack tight">
        <div className="eyebrow">
          {state.round > 1 ? t('clues.grid') : t('clues.thisRound')}
        </div>
        {state.round > 1 ? (
          <ClueGrid
            clues={state.clues}
            players={state.players}
            round={state.round}
            eliminated={state.eliminated}
          />
        ) : (
          <ClueList clues={thisRound} players={state.players} />
        )}
      </div>
    </div>
  );
}
