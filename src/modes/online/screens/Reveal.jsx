/**
 * Your card, on your own phone — no passing, and nobody waiting on you but
 * the people who have not looked yet.
 */

import { useT } from '../../../i18n/index.jsx';
import { PlayerList } from '../../../features/lobby/index.js';
import { RoleCard } from '../../../features/round/index.js';
import { EyeIcon } from '../../../ui/icons/index.jsx';

export function OnlineReveal({ payload, act }) {
  const { t } = useT();
  const { state, you } = payload;
  const done = state.revealed.includes(you);
  const waiting = state.players.length - state.revealed.length;

  // No card dealt to this phone. It should not be able to get here any more —
  // the server forgets a kicked player's token and closes their stream — but
  // the old failure was a `TypeError` on `view.role` that took the whole
  // screen down behind the error boundary, and the cost of saying so plainly
  // instead is three lines.
  if (!payload.private) {
    return (
      <div className="card pad-lg center stack">
        <h2 className="title">{t('errors.notInRoom')}</h2>
      </div>
    );
  }

  if (done) {
    return (
      <div className="stack">
        <div className="card pad-lg center stack">
          <span className="glyph">
            <EyeIcon size={30} anim />
          </span>
          <h2 className="title">{t('reveal.memorised')}</h2>
          <p className="subtitle dots">{t('reveal.waiting', { count: waiting })}</p>
        </div>
        <PlayerList players={state.players} youId={you} />
      </div>
    );
  }

  return (
    <RoleCard
      view={payload.private}
      wordLang={payload.state.config.wordLang}
      customPacks={payload.state.customPacks}
      doneLabel={t('common.gotIt')}
      onDone={() => act({ type: 'MARK_REVEALED' })}
    />
  );
}
