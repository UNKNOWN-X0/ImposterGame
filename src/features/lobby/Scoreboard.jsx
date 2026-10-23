/**
 * The night so far, and what each way of winning pays.
 */

import { ScoreIcon } from '../../ui/icons/index.jsx';
import { WIN_POINTS } from '../../core/engine.js';
import { useT } from '../../i18n/index.jsx';
import { Avatar } from '../../ui/primitives/Avatar.jsx';

/**
 * The night's score.
 *
 * Ordered by points, and a player on zero still appears — a scoreboard that
 * hides the person who has not scored is a scoreboard nobody wants to be on.
 * `gained` marks who just scored, so the end of a game shows what changed
 * rather than only where things stand.
 */
export function Scoreboard({ players, scores = {}, gained = [], award = 1, onClear }) {
  const { t } = useT();
  const rows = players
    .map((p) => ({ ...p, points: scores[p.id] || 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const top = rows[0]?.points ?? 0;

  return (
    <div className="card stack tight">
      <div className="row" style={{ alignItems: 'center' }}>
        <span className="eyebrow grow">
          <ScoreIcon size={15} /> {t('score.title')}
        </span>
        {onClear && top > 0 && (
          <button className="btn-link" onClick={onClear}>
            {t('score.clear')}
          </button>
        )}
      </div>

      {top === 0 ? (
        <p className="hint">{t('score.nobody')}</p>
      ) : (
        <div className="scoreboard stagger">
          {rows.map((row) => (
            <div className={`score-row${row.points === top ? ' leader' : ''}`} key={row.id}>
              <Avatar name={row.name} />
              <span className="grow">{row.name}</span>
              {gained.includes(row.id) && (
                <span className="score-gain">{t('score.gained', { count: award })}</span>
              )}
              <b className="score-points">{t('score.points', { count: row.points })}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What each way of winning pays.
 *
 * Shown in the lobby while scoring is on, because a rule that changes how
 * people play has to be visible before they play — an imposter deciding
 * whether to call needs to know it is worth three.
 */
export function WinValues() {
  const { t } = useT();
  const rows = Object.entries(WIN_POINTS).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card stack tight">
      <div className="eyebrow">{t('score.worth')}</div>
      <div className="worth">
        {rows.map(([reason, points]) => (
          <div className="worth-row" key={reason}>
            <span className="grow">{t(`score.worth.${reason}`)}</span>
            <b>{t('score.points', { count: points })}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
