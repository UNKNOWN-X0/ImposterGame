/**
 * Turning a crash into something a person can send.
 *
 * Pure: no React, no browser, no storage — hand it what went wrong and it
 * hands back a report. That is what makes the one rule in here testable, and
 * the rule matters more than the formatting.
 *
 * **A report must never carry the word.** A crash mid-round is exactly when
 * somebody will paste a report into the group chat that the other players are
 * reading, and a stack trace can quite reasonably contain the thing that was
 * being rendered when it broke. So everything the game is currently keeping
 * secret is redacted on the way out — the word, the imposter's word, the
 * names of who was dealt what. If it is a secret, it is not in the report.
 *
 * What is left is what is actually useful for finding a bug: the version, the
 * phase, the shape of the table, the error, and the last few things that
 * happened — as names of actions, never their contents.
 */

/** Shown in place of anything the game is keeping quiet. */
export const REDACTED = '···';

/**
 * Take every secret out of a piece of text.
 *
 * Long secrets first, so a word that contains another word cannot leave half
 * of itself behind. Case-insensitive, because a stack trace may have shouted
 * it, and whitespace-tolerant for the same reason.
 *
 * Two characters is the floor. A one-letter secret would turn a report into
 * dots, and below that there is nothing to protect; at two and above the
 * trade goes the other way, and a report made harder to read is a much
 * smaller loss than a word that reaches the room. Thai words are short, so
 * this floor stays low on purpose.
 */
export function redact(text, secrets = []) {
  let out = String(text ?? '');
  const worth = [...new Set(secrets)]
    .filter((s) => typeof s === 'string' && s.trim().length > 1)
    .sort((a, b) => b.length - a.length);
  for (const secret of worth) {
    const pattern = secret.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    out = out.replace(new RegExp(pattern, 'gi'), REDACTED);
  }
  return out;
}

/** The first few lines of a stack, which is where the answer usually is. */
function shortStack(stack, lines = 6) {
  return String(stack ?? '')
    .split('\n')
    .slice(0, lines)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Everything worth knowing about one failure.
 *
 * @param error    what was thrown
 * @param context  version, language, phase, players, breadcrumbs, secrets…
 */
export function buildReport(error, context = {}) {
  const {
    version = 'unknown',
    lang = 'unknown',
    wordLang = null,
    mode = null,
    phase = null,
    players = null,
    where = null,
    breadcrumbs = [],
    secrets = [],
    userAgent = null,
    at = new Date().toISOString(),
  } = context;

  const name = error?.name || 'Error';
  const message = error?.message ?? String(error ?? 'unknown');

  return {
    at,
    version,
    lang,
    wordLang,
    mode,
    phase,
    players,
    where: where ? redact(where, secrets) : null,
    error: {
      name,
      // A GameError is a refusal by the rules, and its code is the whole
      // message. Anything else gets redacted in case it quoted the word.
      code: error?.code ?? null,
      message: redact(message, secrets),
      stack: redact(shortStack(error?.stack), secrets),
    },
    breadcrumbs: breadcrumbs.slice(-12),
    userAgent: userAgent ? String(userAgent).slice(0, 160) : null,
  };
}

/** The report as something to paste into a message. */
export function reportText(report) {
  const lines = [
    `Imposter ${report.version} — ${report.error.name}`,
    report.at,
    '',
    // Where it broke and what was being played are different questions, and
    // one used to hide the other: a failed promise reported "promise" and
    // never said whether it was one phone or a room.
    `where     ${report.where ?? 'unknown'}`,
    `mode      ${report.mode ?? '—'}`,
    `phase     ${report.phase ?? '—'}`,
    `players   ${report.players ?? '—'}`,
    `language  ${report.lang}${report.wordLang ? ` / words ${report.wordLang}` : ''}`,
  ];
  if (report.userAgent) lines.push(`browser   ${report.userAgent}`);
  lines.push('', report.error.code ? `code      ${report.error.code}` : `message   ${report.error.message}`);
  if (report.error.code && report.error.message !== report.error.code) {
    lines.push(`message   ${report.error.message}`);
  }
  if (report.error.stack) lines.push('', report.error.stack);
  if (report.breadcrumbs.length) {
    lines.push('', `last steps: ${report.breadcrumbs.join(' → ')}`);
  }
  return lines.join('\n');
}
