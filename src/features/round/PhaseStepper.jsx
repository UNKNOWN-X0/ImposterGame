/**
 * Where in the round everybody is.
 */

import { PHASE } from '../../core/engine.js';
import { useT } from '../../i18n/index.jsx';

/** Where we are in the round — four steps, no surprises. */
export function PhaseStepper({ phase }) {
  const { t } = useT();
  const steps = [
    { id: 'reveal', label: t('step.reveal'), phases: [PHASE.REVEAL] },
    { id: 'clues', label: t('step.clues'), phases: [PHASE.CLUES] },
    { id: 'vote', label: t('step.vote'), phases: [PHASE.VOTE] },
    { id: 'result', label: t('step.result'), phases: [PHASE.VERDICT, PHASE.STEAL, PHASE.GAME_OVER] },
  ];
  const activeIndex = steps.findIndex((s) => s.phases.includes(phase));
  if (activeIndex < 0) return null;

  return (
    <ol className="stepper" aria-label={t('step.result')}>
      {steps.map((step, i) => (
        <li
          key={step.id}
          className={`step${i === activeIndex ? ' now' : ''}${i < activeIndex ? ' done' : ''}`}
          aria-current={i === activeIndex ? 'step' : undefined}
        >
          <span className="step-dot" aria-hidden="true" />
          <span className="step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
