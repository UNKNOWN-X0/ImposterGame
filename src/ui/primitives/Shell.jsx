/**
 * The frame every screen sits in.
 */

import { useState } from 'react';
import { BrandMark, CheckIcon, ChevronLeftIcon, CopyIcon } from '../icons/index.jsx';
import { useT } from '../../i18n/index.jsx';
import { PhaseStepper } from '../../features/round/PhaseStepper.jsx';
import { LanguagePicker } from '../../i18n/LanguagePicker.jsx';
import { ThemePicker } from '../theme/ThemePicker.jsx';

export function Shell({ children, onBack, code, right, phase }) {
  const { t } = useT();
  return (
    <div className="shell">
      <div className="topbar">
        {onBack ? (
          <button className="btn ghost sm" onClick={onBack}>
            <ChevronLeftIcon size={17} /> {t('common.back')}
          </button>
        ) : (
          <div className="brand">
            <BrandMark size={30} />
            {/* The name is a span so the narrowest phones can drop it and
                keep the mark, which is what makes room for the controls. */}
            <span className="brand-name">{t('app.name')}</span>
          </div>
        )}
        <div className="spacer" />
        {code ? <RoomCode code={code} /> : null}
        {right ?? (
          <>
            <ThemePicker />
            <LanguagePicker />
          </>
        )}
      </div>
      {phase ? <PhaseStepper phase={phase} /> : null}
      {children}
    </div>
  );
}

function RoomCode({ code }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  };
  return (
    <button className="roomcode" onClick={copy} title={t('common.copy')}>
      {code}
      <span className="roomcode-action">
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} anim />}
        {/* The words are a span of their own so a narrow phone can drop them
            and keep the icon — including the tick, which is the only thing
            that confirms the code was copied. */}
        <span className="roomcode-label">
          {copied ? t('common.copied') : t('common.copy')}
        </span>
      </span>
    </button>
  );
}

/** Interface language. Per device, and never synced to the room. */
