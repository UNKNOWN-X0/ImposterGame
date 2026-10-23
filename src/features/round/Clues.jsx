/**
 * Whose turn it is, what has been said, and the clock.
 */

import { useEffect, useRef, useState } from 'react';
import { ROUNDS_UNLIMITED } from '../../core/engine.js';
import { useT } from '../../i18n/index.jsx';
import { Avatar } from '../../ui/primitives/Avatar.jsx';

export function TurnOrder({ order, players, current, done = [] }) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? '?';
  return (
    <div className="turn-order">
      {order.map((id) => (
        <span
          key={id}
          className={`turn-chip${id === current ? ' now' : ''}${done.includes(id) ? ' done' : ''}`}
        >
          {nameOf(id)}
        </span>
      ))}
    </div>
  );
}

export function ClueList({ clues, players }) {
  const { t } = useT();
  if (clues.length === 0) return <p className="hint">{t('clues.none')}</p>;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? '?';
  return (
    <div className="clue-list stagger">
      {clues.map((c, i) => (
        <span className="clue" key={i}>
          <span className="who">{nameOf(c.playerId)}</span>
          <span className="what">{c.text}</span>
        </span>
      ))}
    </div>
  );
}

/** "Round 2 of 4", or just "Round 2" when there is no limit. */
export function roundLabel(t, round, maxRounds) {
  return maxRounds === ROUNDS_UNLIMITED
    ? t('clues.roundOpen', { round })
    : t('clues.round', { round, total: maxRounds });
}

/**
 * Every clue, laid out player by player and round by round.
 *
 * Once a game runs past one round, a flat list of chips stops being useful:
 * what you want to compare is what somebody said the first time against what
 * they said the second. A grid puts those side by side, which is exactly the
 * comparison that catches an imposter who has been drifting.
 */
export function ClueGrid({ clues, players, round, eliminated = [] }) {
  const { t } = useT();
  if (clues.length === 0) return <p className="hint">{t('clues.none')}</p>;

  const rounds = Array.from({ length: round }, (_, i) => i + 1);
  const said = new Map();
  for (const c of clues) {
    if (!said.has(c.playerId)) said.set(c.playerId, {});
    said.get(c.playerId)[c.round] = c.text;
  }
  // Only people who have actually spoken belong in the grid.
  const rows = players.filter((p) => said.has(p.id));

  return (
    <div className="card flush cluegrid">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t('lobby.title')}</span>
            </th>
            {rounds.map((r) => (
              <th scope="col" key={r} className={r === round ? 'now' : undefined}>
                {t('clues.roundShort', { round: r })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className={eliminated.includes(p.id) ? 'out' : undefined}>
              <th scope="row">
                <Avatar name={p.name} dim={eliminated.includes(p.id)} />
                <span>{p.name}</span>
              </th>
              {rounds.map((r) => (
                <td key={r} className={r === round ? 'now' : undefined}>
                  {said.get(p.id)?.[r] ?? <span className="blank">·</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClueInput({ onSubmit, disabled }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const word = text.trim();
    if (!word) return;
    onSubmit(word);
    setText('');
  };

  return (
    <form className="row" onSubmit={submit}>
      <input
        ref={ref}
        className="input grow"
        value={text}
        maxLength={24}
        onChange={(e) => setText(e.target.value.replace(/\s/g, ''))}
        placeholder={t('clues.placeholder')}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck="false"
        disabled={disabled}
      />
      <button className="btn primary" disabled={disabled || !text.trim()}>
        {t('clues.say')}
      </button>
    </form>
  );
}

/** A plain clock for the talking phase. */
export function Timer({ seconds = 90 }) {
  const { t } = useT();
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || left <= 0) return undefined;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="card center stack tight">
      <div className={`timer${left === 0 ? ' out' : left <= 10 && running ? ' low' : ''}`}>
        {mm}
        {/* A clock that is running should look like it. The colon blinks on
            the second, which is where the eye expects the movement. */}
        <span className={`colon${running && left > 0 ? ' ticking' : ''}`}>:</span>
        {ss}
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn sm ghost" onClick={() => setRunning((r) => !r)}>
          {running ? t('timer.pause') : t('timer.start')}
        </button>
        <button
          className="btn sm ghost"
          onClick={() => {
            setRunning(false);
            setLeft(seconds);
          }}
        >
          {t('timer.reset')}
        </button>
      </div>
    </div>
  );
}

