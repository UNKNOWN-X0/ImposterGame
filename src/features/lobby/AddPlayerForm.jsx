/**
 * Adding somebody, and saying how many more are needed.
 */

import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../core/engine.js';
import { useT } from '../../i18n/index.jsx';

export function AddPlayerForm({ onAdd, disabled }) {
  const { t } = useT();
  const [name, setName] = useState('');
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName('');
      }}
    >
      <input
        className="input grow"
        value={name}
        maxLength={16}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('lobby.addPlaceholder')}
        disabled={disabled}
        autoComplete="off"
      />
      <button className="btn" disabled={disabled || !name.trim()}>
        {t('lobby.add')}
      </button>
    </form>
  );
}

export function LobbyHint({ count }) {
  const { t } = useT();
  if (count < MIN_PLAYERS)
    return <p className="hint center">{t('lobby.needMore', { count: MIN_PLAYERS - count })}</p>;
  if (count >= MAX_PLAYERS) return <p className="hint center">{t('lobby.full')}</p>;
  return <p className="hint center">{t('lobby.count', { count })}</p>;
}
