/**
 * What's new.
 *
 * A party game gets played by people who did not install it and do not read
 * release notes, so this is short on purpose: a line or three per version, in
 * their language, about what is different at the table. Whoever wants the
 * long version can read CHANGELOG.md.
 *
 * Only the first few releases are on screen. The rest are one tap away,
 * because a wall of twenty-four versions is a wall rather than a history.
 */

import { useState } from 'react';

import { RELEASES, VERSION, noteKey, since } from '../../content/history/changelog.js';
import { useT } from '../../i18n/index.jsx';
import { Shell } from '../../ui/primitives/index.js';

const SHOWN = 5;

export default function Changelog({ onExit, seen }) {
  const { t, lang } = useT();
  const [all, setAll] = useState(false);
  const unseen = new Set(since(seen).map((r) => r.v));
  const releases = all ? RELEASES : RELEASES.slice(0, SHOWN);

  // A date is read by the person in front of it, so it is written the way
  // their language writes one rather than the way the file stores it.
  const dateOf = (iso) => {
    try {
      return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
        .format(new Date(`${iso}T00:00:00`));
    } catch {
      return iso;
    }
  };

  return (
    <Shell onBack={onExit}>
      <div className="stack tight">
        <h1 className="title">{t('log.title')}</h1>
        <p className="subtitle">{t('log.sub', { version: VERSION })}</p>
      </div>

      <div className="stack">
        {releases.map((release) => (
          <div className="card release" key={release.v}>
            <div className="release-head">
              <span className="release-v">{release.v}</span>
              {release.v === VERSION && <span className="tag crew">{t('log.current')}</span>}
              {release.v !== VERSION && unseen.has(release.v) && (
                <span className="tag accent">{t('log.new')}</span>
              )}
              <span className="spacer" />
              <span className="release-date">{dateOf(release.date)}</span>
            </div>
            <ul className="release-notes">
              {release.notes.map((note) => (
                <li key={note}>{t(noteKey(release.v, note))}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {!all && RELEASES.length > SHOWN && (
        <button className="btn-link" onClick={() => setAll(true)}>
          {t('log.earlier', { count: RELEASES.length - SHOWN })}
        </button>
      )}

      <button className="btn primary block lg" onClick={onExit}>
        {t('common.gotIt')}
      </button>
    </Shell>
  );
}
