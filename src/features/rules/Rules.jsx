/**
 * The rules screen.
 *
 * The step and the credit line live beside it in their own files, because
 * both are needed on screens that load before this one does — and this one
 * is now fetched only when somebody taps "How do you play?".
 */

import { Shell } from '../../ui/primitives/index.js';
import { useT } from '../../i18n/index.jsx';
import { Credit } from './Credit.jsx';
import { Step } from './Step.jsx';

export { Credit } from './Credit.jsx';
export { Step } from './Step.jsx';

export function Rules({ onExit }) {
  const { t } = useT();
  return (
    <Shell onBack={onExit}>
      <h1 className="title">{t('rules.title')}</h1>

      <div className="card stack">
        {[1, 2, 3, 4].map((n) => (
          <Step key={n} n={n} title={t(`rules.${n}.title`)}>
            {t(`rules.${n}.body`)}
          </Step>
        ))}
      </div>

      <div className="card stack tight">
        <div className="eyebrow">{t('rules.tips.title')}</div>
        <p className="subtitle">{t('rules.tips.body')}</p>
      </div>

      <button className="btn primary block lg" onClick={onExit}>
        {t('common.gotIt')}
      </button>

      <Credit />
    </Shell>
  );
}

