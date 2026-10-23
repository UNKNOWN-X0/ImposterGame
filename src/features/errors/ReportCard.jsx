/**
 * The report, as something to hand over.
 *
 * Shared by the screen you get when the game stops and the notice you get
 * when something went wrong quietly, so the two cannot drift into saying
 * different things about the same failure.
 */

import { useState } from 'react';

import { useT } from '../../i18n/index.jsx';
import { CheckIcon, CopyIcon } from '../../ui/icons/index.jsx';
import { reportText } from './report.js';

export function ReportCard({ report, open = false, toggle = true }) {
  const { t } = useT();
  const [showing, setShowing] = useState(open);
  const [copied, setCopied] = useState(false);
  const text = report ? reportText(report) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // No clipboard: show it, which is the only other way to hand it over.
      setShowing(true);
    }
  };

  return (
    <div className="card stack tight">
      <span className="eyebrow">{t('crash.reportTitle')}</span>
      <p className="hint">{t('crash.reportBody')}</p>
      <div className="row wrap">
        <button className="btn sm grow" onClick={copy}>
          {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}{' '}
          {copied ? t('common.copied') : t('crash.copy')}
        </button>
        {/* The quiet notice already has one of these, and two buttons
            saying "hide it" next to each other is one too many. */}
        {toggle && (
          <button className="btn sm ghost" onClick={() => setShowing((s) => !s)}>
            {showing ? t('crash.hide') : t('crash.show')}
          </button>
        )}
      </div>
      {showing && <textarea className="input report" value={text} rows={12} readOnly />}
      <p className="hint">{t('crash.noWord')}</p>
    </div>
  );
}
