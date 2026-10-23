import { useEffect, useRef } from 'react';
import { useT } from '../../../i18n/index.jsx';
import { BrandMark } from '../../../ui/icons/index.jsx';

/**
 * "You were in the middle of a game."
 *
 * A phone that reloads mid-round used to lose the round: sleep too long
 * during the clue phase, or pull to refresh by accident, and the table was
 * back on the home screen with the cards gone. The round is written down
 * after every action now, and this is where it is offered back.
 *
 * Offered, not restored. Somebody who reloaded by accident wants it; somebody
 * opening the game a week later to set up a new table does not, and being
 * dropped into a stale round with last week's players in it is its own kind
 * of broken. So it asks, once, and takes either answer as final.
 */
export function Resume({ game, onResume, onFresh }) {
  const { t } = useT();
  const card = useRef(null);

  useEffect(() => {
    card.current?.focus();
  }, []);

  const names = game.players.map((p) => p.name).join(', ');

  return (
    <div className="scrim">
      <div
        className="modal stack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-title"
        tabIndex={-1}
        ref={card}
      >
        <div className="center stack tight">
          <BrandMark size={52} />
          <h2 className="title" id="resume-title">
            {t('resume.title')}
          </h2>
          {/* The round and the names, because that is how somebody tells last
              week's game from the one they were playing a minute ago. */}
          <p className="subtitle">{t('resume.body', { round: game.round, names })}</p>
        </div>

        <div className="stack tight">
          <button className="btn primary block lg" onClick={onResume}>
            {t('resume.yes')}
          </button>
          <button className="btn block" onClick={onFresh}>
            {t('resume.no')}
          </button>
        </div>
      </div>
    </div>
  );
}
