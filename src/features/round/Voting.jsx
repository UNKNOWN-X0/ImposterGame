/**
 * Choosing somebody, and watching everyone else choose.
 */

import { CheckIcon } from '../../ui/icons/index.jsx';
import { useT } from '../../i18n/index.jsx';
import { Avatar } from '../../ui/primitives/Avatar.jsx';

export function VoteGrid({ players, eliminated = [], youId, chosenId, onVote, disabled }) {
  const { t } = useT();
  return (
    <div className="vote-grid stagger">
      {players.map((p) => {
        const out = eliminated.includes(p.id);
        const self = p.id === youId;
        return (
          <button
            key={p.id}
            className={`vote-btn${chosenId === p.id ? ' chosen' : ''}`}
            disabled={disabled || out || self}
            onClick={() => onVote(p.id)}
          >
            <Avatar name={p.name} dim={out} />
            <span className="grow">{p.name}</span>
            {self && <span className="tag you">{t('tag.you')}</span>}
            {out && <span className="tag">{t('tag.out')}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Who has voted — never who they voted for.
 *
 * Showing the count alone leaves everyone staring at a number wondering who
 * is holding things up. Showing the names keeps the pressure where it belongs
 * without leaking anything about the vote itself.
 */
export function VoteProgress({ players, votedIds = [] }) {
  const { t } = useT();
  const waiting = players.filter((p) => !votedIds.includes(p.id));
  return (
    <div className="card stack tight">
      <div className="eyebrow">{waiting.length ? t('vote.waitingOn') : t('vote.counting')}</div>
      <div className="voters stagger">
        {players.map((p) => {
          const voted = votedIds.includes(p.id);
          return (
            <span className={`voter${voted ? ' voted' : ''}`} key={p.id}>
              <Avatar name={p.name} dim={!voted} />
              <span>{p.name}</span>
              {voted && (
                // Mounted the moment that phone's vote lands, so the pop is
                // the notification — no separate flash needed.
                <span className="tick pop-in" aria-label={t('vote.done')}>
                  <CheckIcon size={15} />
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function Tally({ counts, players }) {
  const { t } = useT();
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const rows = players
    .map((p) => ({ ...p, n: counts[p.id] || 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  if (rows.length === 0) return null;
  return (
    <div className="tally">
      {rows.map((r, i) => (
        <div className="tally-row" key={r.id}>
          <div>
            <b>{r.name}</b>
            <div className="bar">
              {/* Width is the real figure; the grow is a scale on top of it,
                  so a bar never animates to the wrong length. */}
              <span
                className="grow-in"
                style={{ width: `${(r.n / total) * 100}%`, animationDelay: `${0.08 * i + 0.1}s` }}
              />
            </div>
          </div>
          <span className="tag">{t('vote.count', { count: r.n })}</span>
        </div>
      ))}
    </div>
  );
}

