/**
 * Voting from your own phone, where nobody can see who you picked.
 */

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/index.jsx';
import { ClueGrid, ClueList, VoteGrid, VoteProgress } from '../../../features/round/index.js';

export function OnlineVote({ payload, act }) {
  const { t } = useT();
  const { state, you } = payload;
  const [chosen, setChosen] = useState(null);

  // A new voting round clears last round's choice.
  useEffect(() => {
    setChosen(null);
  }, [state.round]);

  const alive = state.players.filter((p) => !state.eliminated.includes(p.id));
  const iAmOut = state.eliminated.includes(you);
  const left = alive.length - (state.votedSoFar ?? 0);

  return (
    <div className="stack">
      <div className="stack tight">
        <h1 className="title">{t('vote.title')}</h1>
        <p className="subtitle">{iAmOut ? t('vote.outSub') : t('vote.hiddenSub')}</p>
      </div>

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
          <ClueList
            clues={state.clues.filter((c) => c.round === state.round)}
            players={state.players}
          />
        )}
      </div>

      <VoteGrid
        players={alive}
        eliminated={state.eliminated}
        youId={you}
        chosenId={chosen}
        disabled={iAmOut}
        onVote={(id) => {
          setChosen(id);
          act({ type: 'CAST_VOTE', targetId: id });
        }}
      />

      <VoteProgress players={alive} votedIds={state.votedIds ?? []} />

      <p className="hint center">
        {left > 0 ? (
          <span className="dots">{t('vote.left', { count: left })}</span>
        ) : (
          t('vote.counting')
        )}
      </p>

      {chosen && <p className="hint center">{t('vote.canChange')}</p>}
    </div>
  );
}
