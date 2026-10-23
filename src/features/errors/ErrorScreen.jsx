/**
 * What a player sees instead of a blank screen.
 *
 * The audience for this is somebody holding a phone in the middle of a party,
 * who does not care what a component is. So: one sentence saying the game
 * stopped and that nothing they did caused it, one button that gets them back
 * to a game, and the report tucked underneath for whoever ends up looking at
 * it.
 *
 * The report is shown only when asked for. Opening with a stack trace tells a
 * player they have broken something expensive.
 */

import { useT } from '../../i18n/index.jsx';
import { Shell } from '../../ui/primitives/index.js';
import { BrokenIcon } from '../../ui/icons/index.jsx';
import { ReportCard } from './ReportCard.jsx';

export function ErrorScreen({ report, onRestart }) {
  const { t } = useT();

  return (
    <Shell>
      <div className="card pad-lg center stack">
        <span className="glyph big danger">
          <BrokenIcon size={30} />
        </span>
        <h1 className="title">{t('crash.title')}</h1>
        <p className="subtitle">{t('crash.body')}</p>
        <p className="hint">{t('crash.notYourFault')}</p>
      </div>

      <button className="btn primary block lg" onClick={onRestart}>
        {t('crash.restart')}
      </button>

      <ReportCard report={report} />
    </Shell>
  );
}
