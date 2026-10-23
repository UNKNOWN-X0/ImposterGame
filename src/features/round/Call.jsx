/**
 * An imposter naming the word mid-round.
 */

import { useState } from 'react';
import { BellIcon, ShrugIcon } from '../../ui/icons/index.jsx';
import { useT } from '../../i18n/index.jsx';

export function CallButton({ onClick }) {
  const { t } = useT();
  return (
    <button className="btn ghost block" onClick={onClick}>
      <BellIcon size={17} /> {t('call.button')}
    </button>
  );
}

/** The imposter's mid-round guess. Right wins it outright; wrong ends them. */
export function CallPanel({ onCall, onCancel }) {
  const { t } = useT();
  const [text, setText] = useState('');
  return (
    <div className="card pad-lg stack">
      <div className="center stack tight">
        <span className="glyph danger">
          <BellIcon size={30} anim />
        </span>
        <h2 className="title">{t('call.title')}</h2>
        <p className="subtitle">{t('call.sub')}</p>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onCall(text.trim());
        }}
      >
        <input
          className="input grow"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('call.placeholder')}
          autoCapitalize="none"
          autoComplete="off"
          autoFocus
        />
        <button className="btn danger" disabled={!text.trim()}>
          {t('call.confirm')}
        </button>
      </form>
      <button className="btn-link" onClick={onCancel}>
        {t('call.back')}
      </button>
    </div>
  );
}

/** Shown on a shared phone when the person holding it is not an imposter. */
export function NotTheImposter({ onBack }) {
  const { t } = useT();
  return (
    <div className="card pad-lg center stack">
      <span className="glyph">
        <ShrugIcon size={30} anim />
      </span>
      <h2 className="title">{t('call.notYou')}</h2>
      <p className="subtitle">{t('call.notYouBody')}</p>
      <button className="btn primary block" onClick={onBack}>
        {t('call.back')}
      </button>
    </div>
  );
}

