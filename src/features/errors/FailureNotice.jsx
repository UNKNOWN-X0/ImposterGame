/**
 * Something went wrong, but not badly enough to stop the game.
 *
 * An error boundary only catches what breaks while drawing. A promise that
 * rejects, or a handler that throws on a tap, leaves the screen looking
 * perfectly fine and quietly not working — a vote that never arrives, a card
 * that never turns over. Silence there is worse than a small line of text,
 * because the table will spend the next five minutes blaming each other's
 * phones.
 *
 * So: one quiet line, at the bottom, out of the way of whatever is happening.
 * It can be dismissed, and it says what it knows if asked.
 */

import { useEffect, useState } from 'react';

import { useT } from '../../i18n/index.jsx';
import { BrokenIcon } from '../../ui/icons/index.jsx';
import { onFailure } from './log.js';
import { ReportCard } from './ReportCard.jsx';

export function FailureNotice() {
  const { t } = useT();
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => onFailure((latest) => setReport(latest)), []);

  if (!report) return null;

  return (
    <div className="failure-notice" role="status">
      <button className="failure-line" onClick={() => setOpen((o) => !o)}>
        <BrokenIcon size={15} />
        <span className="grow">{t('crash.quiet')}</span>
        <span className="hint">{open ? t('crash.hide') : t('crash.show')}</span>
      </button>
      {open && <ReportCard report={report} open toggle={false} />}
      <button className="btn-link" onClick={() => setReport(null)}>
        {t('crash.dismiss')}
      </button>
    </div>
  );
}
