/**
 * Every sentence in the game, in all three languages, side by side.
 *
 * Not part of the game: it is reached by putting `#strings` on the end of the
 * address, and nothing links to it. It exists because the suite can only tell
 * you that a key is missing or that a sentence was copied — it cannot tell
 * you whether the German is any good, and a translator cannot answer that
 * from a failing test. This shows the three of them next to each other, which
 * is the only way that question has ever been answerable.
 *
 * It reads the same tables the game reads, so it cannot drift from what
 * players see. The languages are fetched when it opens, because a phone only
 * downloads the one it is reading.
 *
 * English only in its own furniture, deliberately: it is a workbench.
 */

import { useEffect, useMemo, useState } from 'react';

import { Segmented } from '../../ui/primitives/index.js';

import { LANGUAGES, STRINGS, loadAllStrings } from '../../i18n/strings/index.js';
import { compareAll, hasTrouble } from '../../i18n/compare.js';

const FILTERS = [
  ['all', 'Everything'],
  ['trouble', 'Worth a look'],
  ['missing', 'Missing'],
  ['copied', 'Still English'],
  ['placeholders', 'Placeholders'],
];

export default function StringBoard() {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('trouble');

  useEffect(() => {
    // Nothing here works until every language is in memory, and on a phone
    // only one of them is.
    loadAllStrings().then(() => setReady(true));
  }, []);

  const rows = useMemo(() => {
    if (!ready) return [];
    return compareAll(STRINGS);
  }, [ready]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'trouble' && !hasTrouble(row)) return false;
      if (filter === 'missing' && row.missing.length === 0) return false;
      if (filter === 'copied' && row.copied.length === 0) return false;
      if (filter === 'placeholders' && row.placeholders.length === 0) return false;
      if (!needle) return true;
      if (row.key.toLowerCase().includes(needle)) return true;
      return Object.values(row.by).some((v) => String(v ?? '').toLowerCase().includes(needle));
    });
  }, [rows, filter, query]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      trouble: rows.filter(hasTrouble).length,
      missing: rows.filter((r) => r.missing.length).length,
      copied: rows.filter((r) => r.copied.length).length,
      placeholders: rows.filter((r) => r.placeholders.length).length,
    }),
    [rows],
  );

  if (!ready) return <p className="subtitle center dots">Fetching every language…</p>;

  return (
    <div className="shell board stack">
      <div className="stack tight">
        <h1 className="title">Strings</h1>
        <p className="subtitle">
          {counts.all} keys · {counts.missing} missing · {counts.copied} still English ·{' '}
          {counts.placeholders} with placeholder trouble
        </p>
      </div>

      <Segmented wide>
        {FILTERS.map(([id, label]) => (
          <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} ({counts[id]})
          </button>
        ))}
      </Segmented>

      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a key or a sentence…"
        spellCheck="false"
        autoCapitalize="none"
      />

      {shown.length === 0 && (
        <p className="hint center">
          {filter === 'trouble' && !query
            ? 'Nothing to look at — all three languages agree.'
            : 'Nothing matches.'}
        </p>
      )}

      <div className="stack">
        {shown.map((row) => (
          <StringRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function StringRow({ row }) {
  const trouble = (lang) => {
    if (row.missing.includes(lang)) return 'missing';
    // Not a fault: this language does not count its nouns, and the reader
    // gets its own plural form rather than an English one.
    if (row.noPlural?.includes(lang)) return 'no singular';
    if (row.copied.includes(lang)) return 'still English';
    const placeholder = row.placeholders.find((p) => p.lang === lang);
    return placeholder ? placeholder.trouble : null;
  };

  return (
    <div className={`string-row${hasTrouble(row) ? ' flagged' : ''}`}>
      <code className="string-key">{row.key}</code>
      <div className="stack tight">
        {LANGUAGES.map(({ id, short, flag }) => {
          const note = trouble(id);
          return (
            <p
              key={id}
              className={`string-line${note && note !== 'no singular' ? ' flagged' : ''}`}
              lang={id}
            >
              <span className="string-lang" aria-hidden="true">
                {flag} {short}
              </span>
              <span className="string-text">
                {row.by[id] ?? (
                  <em>
                    {row.noPlural?.includes(id)
                      ? '— uses its own plural form —'
                      : '— falls back to English —'}
                  </em>
                )}
              </span>
              {note && <span className="tag imposter">{note}</span>}
            </p>
          );
        })}
      </div>
    </div>
  );
}
