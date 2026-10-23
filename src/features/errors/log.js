/**
 * What the app knows about itself when something goes wrong.
 *
 * Three small pieces of state, all in memory and none of it written anywhere:
 *
 *   - **breadcrumbs**, the names of the last few things that happened. Names
 *     only: `SUBMIT_CLUE`, not what the clue was. A trail of action names is
 *     enough to see how a screen got into the state it crashed in, and it
 *     cannot leak anything because there is nothing in it to leak.
 *   - **secrets**, whatever the game is currently keeping quiet, so a report
 *     can have them taken out. Whoever deals sets them; ending a game clears
 *     them.
 *   - **the last few failures**, so the screen can show one and a person can
 *     look at what happened before it.
 *
 * Nothing here is persisted. A crash report is for the minute after the crash;
 * keeping one on the device until next Tuesday helps nobody and is one more
 * place for a word to sit.
 */

import { buildReport } from './report.js';

const TRAIL = 12;
const KEEP = 5;

let breadcrumbs = [];
let secrets = [];
let failures = [];
let listeners = new Set();
let facts = {};

/** Something happened. Names only — never what was in it. */
export function note(name) {
  if (!name) return;
  breadcrumbs = [...breadcrumbs, String(name)].slice(-TRAIL);
}

/** What the game is keeping quiet, so reports can leave it out. */
export function keepQuiet(values = []) {
  secrets = values.filter((v) => typeof v === 'string' && v.trim());
}

/**
 * Add to what the app can say about itself.
 *
 * Merged rather than replaced, because several places know one fact each and
 * none of them knows the others: startup knows the version, the language
 * provider knows the language, a running game knows the phase. A single slot
 * would mean whoever spoke last erased the rest.
 *
 * Passing null for a key removes it, which is how a game says it has ended —
 * a report from the home screen should not claim to be from round three.
 */
export function describe(partial = {}) {
  const next = { ...facts, ...partial };
  for (const [key, value] of Object.entries(next)) {
    if (value === null || value === undefined) delete next[key];
  }
  facts = next;
}

/** What would be said about the app right now. */
export const described = () => ({ ...facts });

export const currentSecrets = () => [...secrets];
export const trail = () => [...breadcrumbs];
export const failuresSoFar = () => [...failures];

/** Tell the screen when something new goes wrong. */
export function onFailure(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Record a failure and hand back the report for it.
 *
 * Deliberately forgiving: this runs when things are already going badly, and
 * a reporter that throws while reporting turns a broken screen into a blank
 * one.
 */
export function record(error, extra = {}) {
  let report;
  try {
    report = buildReport(error, {
      ...facts,
      ...extra,
      breadcrumbs: trail(),
      secrets: [...currentSecrets(), ...(extra.secrets ?? [])],
      userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    });
  } catch {
    report = buildReport(error, {
      ...extra,
      breadcrumbs: trail(),
      secrets: currentSecrets(),
    });
  }
  failures = [...failures, report].slice(-KEEP);
  for (const listener of listeners) {
    try {
      listener(report);
    } catch {
      /* a listener that throws does not get to take the page with it */
    }
  }
  return report;
}

/** Forget everything, including how to describe ourselves. */
export function forget() {
  breadcrumbs = [];
  secrets = [];
  failures = [];
  facts = {};
}

/**
 * Catch the failures React never sees.
 *
 * An error boundary only knows about errors thrown while rendering. A promise
 * that rejects, or a handler that throws on a click, goes past it and leaves
 * the game looking fine and behaving oddly.
 */
export function watchTheWindow(target = typeof window === 'undefined' ? null : window) {
  if (!target) return () => {};
  const onError = (event) => record(event.error ?? event.message, { where: 'window' });
  const onRejection = (event) => record(event.reason, { where: 'promise' });
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
