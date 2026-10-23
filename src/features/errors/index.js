/**
 * When something goes wrong.
 *
 * Two halves. `report.js` is the pure one: what a failure looks like written
 * down, and the rule that a report never carries the word. `log.js` is the
 * one with state: the trail of what happened, what is currently secret, and
 * the last few failures. The two React pieces sit on top.
 *
 * Rule violations are not failures and do not come through here — those are
 * codes from src/core/errors.js, turned into sentences by src/i18n and shown
 * as a banner. This is for the things nobody planned for.
 */

export { ErrorBoundary } from './ErrorBoundary.jsx';
export { ErrorScreen } from './ErrorScreen.jsx';
export { FailureNotice } from './FailureNotice.jsx';
export { ReportCard } from './ReportCard.jsx';
export { buildReport, reportText, redact, REDACTED } from './report.js';
export {
  note,
  keepQuiet,
  describe,
  described,
  record,
  forget,
  trail,
  failuresSoFar,
  onFailure,
  watchTheWindow,
} from './log.js';
