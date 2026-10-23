/**
 * Choosing the language the buttons are in.
 */

import { useEffect, useRef, useState } from 'react';
import { CheckIcon, GlobeIcon } from '../ui/icons/index.jsx';
import { LANGUAGES, useT } from './index.jsx';

/**
 * Three languages, in a menu of our own.
 *
 * It used to be a native <select>, which on a phone throws up the operating
 * system's own wheel — a different shape, a different typeface and a
 * different set of colours from everything around it, in the middle of a
 * game. This is the same sheet the display menu uses, so the header behaves
 * like one thing.
 */
export function LanguagePicker() {
  const { lang, setLang, t } = useT();
  const current = LANGUAGES.find((l) => l.id === lang) ?? LANGUAGES[0];
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div className="pickerwrap" ref={wrap}>
      <button
        className="langpicker"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={t('common.language')}
      >
        <GlobeIcon size={16} anim={open} />
        <span className="sr-only">{t('common.language')}</span>
        <span aria-hidden="true">{current.short}</span>
      </button>

      {open && (
        <div className="sheet" role="dialog" aria-label={t('common.language')}>
          <div className="eyebrow">{t('common.language')}</div>
          <div className="choices">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                className="choice"
                aria-pressed={l.id === lang}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true">{l.flag}</span>
                <span className="grow">{l.label}</span>
                {l.id === lang && <CheckIcon size={16} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
