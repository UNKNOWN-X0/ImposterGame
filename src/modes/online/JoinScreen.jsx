/**
 * The way in: open a room, or join one with the code somebody read out.
 *
 * This is the only screen in the game that can fail for a reason outside the
 * rules — no server, a wrong code, a phone on the wrong wifi — so most of it
 * is about saying which of those happened.
 */

import { useEffect, useState } from 'react';
import { useErrorText, useT } from '../../i18n/index.jsx';
import { createRoom, joinRoom, serverInfo } from './useRoom.js';
import { Banner, Shell } from '../../ui/primitives/index.js';

/* ------------------------------------------------------------------ *
 * Getting in
 * ------------------------------------------------------------------ */

export function JoinScreen({ onJoined, onExit, initialCode }) {
  const { t, lang } = useT();
  const errorText = useErrorText();
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [server, setServer] = useState('checking'); // checking | up | down
  // How long the codes are here. Four on a laptop at a party; a deployment on
  // the open internet may hand out longer ones, and the box has to take them.
  const [codeLength, setCodeLength] = useState(4);

  useEffect(() => {
    let live = true;
    serverInfo().then((info) => {
      if (!live) return;
      setServer(info ? 'up' : 'down');
      if (info) setCodeLength(info.codeLength);
    });
    return () => {
      live = false;
    };
  }, []);

  const go = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      onJoined(await fn());
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell onBack={onExit}>
      {error && <Banner kind="error">{errorText(error)}</Banner>}

      <div className="stack tight">
        <h1 className="title">{t('join.title')}</h1>
        <p className="subtitle">{t('join.sub')}</p>
      </div>

      {server === 'down' && (
        <Banner>
          <b>{t('join.noServerTitle')}</b>{' '}
          {t('join.noServerBody', { command: 'npm run party' })}
        </Banner>
      )}

      <div className="card stack">
        <label className="stack tight">
          <span className="eyebrow">{t('join.yourName')}</span>
          <input
            className="input"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('join.namePlaceholder')}
            autoComplete="off"
          />
        </label>

        <button
          className="btn primary block lg"
          disabled={busy || !name.trim() || server === 'down'}
          // The words come in the language the host is reading the buttons
          // in — the same default the one-phone mode has always used. Anyone
          // can change it in settings; nobody has to notice it first.
          onClick={() => go(() => createRoom(name.trim(), { wordLang: lang }))}
        >
          {t('join.start')}
        </button>
      </div>

      <div className="card stack">
        <span className="eyebrow">{t('join.or')}</span>
        <input
          className="input code"
          value={code}
          maxLength={codeLength}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder={t('join.codePlaceholder')}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
        <button
          className="btn block lg"
          disabled={busy || !name.trim() || code.length < 4 || server === 'down'}
          onClick={() => go(() => joinRoom(code, name.trim()))}
        >
          {t('join.join')}
        </button>
      </div>
    </Shell>
  );
}
