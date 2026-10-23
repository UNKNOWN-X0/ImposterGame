/**
 * Two ways to vote around one table: a show of hands that somebody taps in,
 * or the phone passed around so nobody sees anybody else's choice.
 */

import { useState } from 'react';
import { alivePlayers } from '../../../core/engine.js';
import { useT } from '../../../i18n/index.jsx';
import { PassGate, VoteGrid } from '../../../features/round/index.js';

/* ------------------------------------------------------------------ *
 * Voting — by hands, or by passing the phone
 * ------------------------------------------------------------------ */

export function Voting({ state, run }) {
  const { t } = useT();
  const [mode, setMode] = useState('hands');
  const alive = alivePlayers(state);

  if (mode === 'secret')
    return <SecretVote state={state} run={run} onCancel={() => setMode('hands')} />;

  return (
    <div className="stack">
      <div className="stack tight">
        <h1 className="title">{t('vote.title')}</h1>
        <p className="subtitle">{t('vote.handsSub')}</p>
      </div>

      <VoteGrid
        players={alive}
        eliminated={state.eliminated}
        onVote={(id) => run({ type: 'DECLARE_ELIMINATION', playerId: id })}
      />

      <button
        className="btn ghost block"
        onClick={() => run({ type: 'DECLARE_ELIMINATION', playerId: null })}
      >
        {t('vote.nobody')}
      </button>

      <button className="btn-link" onClick={() => setMode('secret')}>
        {t('vote.secretLink')}
      </button>
    </div>
  );
}

function SecretVote({ state, run, onCancel }) {
  const { t } = useT();
  const [holding, setHolding] = useState(false);
  const alive = alivePlayers(state);
  const voter = alive.find((p) => !(p.id in state.votes));

  // The last vote resolves the round, so this screen simply disappears.
  if (!voter) return null;

  if (!holding) {
    return (
      <div className="stack">
        <PassGate
          name={voter.name}
          onReady={() => setHolding(true)}
          note={t('vote.yourVote')}
        />
        <p className="hint center">
          {t('vote.votesIn', { done: Object.keys(state.votes).length, total: alive.length })}
        </p>
        <button className="btn-link" onClick={onCancel}>
          {t('vote.backToHands')}
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stack tight">
        <div className="eyebrow">{voter.name}</div>
        <h1 className="title">{t('vote.whoSuspect')}</h1>
      </div>
      <VoteGrid
        players={alive}
        eliminated={state.eliminated}
        youId={voter.id}
        onVote={(id) => {
          setHolding(false);
          run({ type: 'CAST_VOTE', voterId: voter.id, targetId: id });
        }}
      />
    </div>
  );
}
