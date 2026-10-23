/**
 * Choosing how the game looks.
 */

import { useEffect, useRef, useState } from 'react';
import { ContrastIcon } from '../icons/index.jsx';
import { MODES, THEMES, useTheme } from './index.jsx';
import { useT } from '../../i18n/index.jsx';
import { Segmented } from '../primitives/Segmented.jsx';

/**
 * Light, dark or whatever the phone says — and which colours.
 *
 * Both live on this device and are remembered here. They are deliberately not
 * game settings: the host does not get to decide what everyone else's screen
 * looks like, and a phone that goes dark at sunset should take its owner's
 * game with it without asking anybody.
 */
export function ThemePicker() {
  const { t } = useT();
  const { mode, resolved, theme, setMode, setTheme } = useTheme();
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
        className="iconpicker"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={t('display.title')}
      >
        <ContrastIcon size={17} anim={open} />
        <span className="sr-only">{t('display.title')}</span>
      </button>

      {open && (
        <div className="sheet" role="dialog" aria-label={t('display.title')}>
          <div className="eyebrow">{t('display.appearance')}</div>
          <Segmented wide>
            {MODES.map((id) => (
              <button
                key={id}
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
              >
                {t(`display.mode.${id}`)}
              </button>
            ))}
          </Segmented>
          <p className="hint">
            {mode === 'system' ? t('display.followsPhone') : t('display.fixedHere')}
          </p>

          <div className="eyebrow" style={{ marginTop: 6 }}>
            {t('display.theme')}
          </div>
          <div className="swatches">
            {THEMES.map((option) => {
              const [surface, accent] = option[resolved];
              return (
                <button
                  key={option.id}
                  className="swatch"
                  aria-pressed={theme === option.id}
                  onClick={() => setTheme(option.id)}
                  title={t(`theme.${option.id}`)}
                >
                  <span
                    className="swatch-chip"
                    aria-hidden="true"
                    style={{ background: surface, borderColor: accent }}
                  >
                    <span style={{ background: accent }} />
                  </span>
                  {t(`theme.${option.id}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
