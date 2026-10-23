/**
 * Every pack, and what is in it.
 *
 * Until now a pack was a name on a chip: you turned ✈️ Travel & Transport on
 * without ever seeing that it holds "Aeroplane → Helicopter". That is fine
 * until somebody asks whether a word is in there, or whether two packs say
 * the same thing, or wants to copy ours as a starting point for theirs.
 *
 * So: a shelf of every pack for one word language, opened one at a time, with
 * a search across all of them. The table's own packs sit at the top with a
 * pencil, because those are the ones anybody is going to change.
 *
 * It does not select packs for a game. Choosing what to deal from belongs
 * with the other settings, next to the count of how many words that leaves.
 */

import { useMemo, useState } from 'react';

import { packsFor, WORD_LANGUAGES } from '../../content/words/index.js';
import { useWords } from './useWords.js';
import { useT } from '../../i18n/index.jsx';
import { ChevronLeftIcon, CopyIcon, CheckIcon, PencilIcon, PlusIcon } from '../../ui/icons/index.jsx';
import { Segmented } from '../../ui/primitives/index.js';
import { matchAt, shelfFor } from './search.js';

export default function PackLibrary({
  lang: initialLang,
  customPacks = [],
  onEdit,
  onLang,
  onClose,
}) {
  const { t } = useT();
  const [lang, setLang] = useState(initialLang);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);

  const q = query.trim().toLowerCase();
  // Fetched per language, so switching the tab at the top of the shelf may
  // mean waiting a moment the first time. `haveWords` is in the dependencies
  // so the shelf redraws itself once they land.
  const haveWords = useWords(lang);
  const packs = useMemo(() => packsFor(lang, customPacks), [lang, customPacks, haveWords]);

  // A pack the table wrote comes first: it is the one somebody is here for.
  const shelf = useMemo(() => shelfFor(packs, q), [packs, q]);

  const total = packs.reduce((n, pack) => n + pack.pairs.length, 0);
  const found = shelf.reduce((n, { pairs }) => n + pairs.length, 0);

  return (
    <div className="stack">
      <div className="stack tight">
        <h1 className="title">{t('library.title')}</h1>
        <p className="subtitle">
          {q
            ? t('library.found', { count: found })
            : t('library.total', { count: total, packs: packs.length })}
        </p>
      </div>

      <Segmented wide>
        {WORD_LANGUAGES.map((l) => (
          <button
            key={l.id}
            aria-pressed={lang === l.id}
            onClick={() => {
              setLang(l.id);
              setOpen(null);
              onLang?.(l.id);
            }}
          >
            <span aria-hidden="true">{l.flag}</span> {l.label}
          </button>
        ))}
      </Segmented>

      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('library.search')}
        type="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck="false"
      />

      {onEdit && (
        <button className="btn block" onClick={() => onEdit(null)}>
          <PlusIcon size={16} /> {t('packs.add')}
        </button>
      )}

      {shelf.length === 0 ? (
        <p className="hint center">{t('library.nothing', { query: query.trim() })}</p>
      ) : (
        <div className="stack tight">
          {shelf.map(({ pack, pairs }) => (
            <PackRow
              key={pack.id}
              pack={pack}
              pairs={pairs}
              query={q}
              open={open === pack.id || Boolean(q)}
              onToggle={() => setOpen(open === pack.id ? null : pack.id)}
              onEdit={onEdit && pack.custom ? () => onEdit(pack.id) : null}
            />
          ))}
        </div>
      )}

      <p className="hint center">{t('library.note')}</p>

      <button className="btn-link" onClick={onClose}>
        {t('common.back')}
      </button>
    </div>
  );
}

function PackRow({ pack, pairs, query, open, onToggle, onEdit }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(null);

  const asList = () => pack.pairs.map((p) => (p.decoy ? `${p.word}, ${p.decoy}` : p.word)).join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asList());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // No clipboard on this phone: put the list where it can be selected.
      setFallback(asList());
    }
  };

  return (
    <div className={`card pack-row${open ? ' open' : ''}`}>
      <button className="pack-row-head" onClick={onToggle} aria-expanded={open}>
        <span className="pack-row-emoji" aria-hidden="true">
          {pack.emoji}
        </span>
        <span className="pack-row-id">
          <b>{pack.name}</b>
          <span className="hint">
            {query
              ? t('library.matches', { count: pairs.length, total: pack.pairs.length })
              : t('packs.count', { count: pack.pairs.length })}
            {pack.custom ? ` · ${t('library.yours')}` : ''}
          </span>
        </span>
        <span className="chev" aria-hidden="true">
          <ChevronLeftIcon size={16} />
        </span>
      </button>

      {open && (
        <>
          <ul className="word-list">
            {pairs.map((pair) => (
              <li key={pair.word}>
                <Marked text={pair.word} query={query} />
                {pair.decoy && (
                  <>
                    <span className="to" aria-hidden="true">
                      →
                    </span>
                    <span className="decoy">
                      <Marked text={pair.decoy} query={query} />
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="row wrap">
            <span className="hint grow">{t('library.hintLine', { hint: pack.hint })}</span>
            <button className="btn sm" onClick={copy}>
              {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}{' '}
              {copied ? t('common.copied') : t('library.copy')}
            </button>
            {onEdit && (
              <button className="btn sm" onClick={onEdit}>
                <PencilIcon size={15} /> {t('packs.edit')}
              </button>
            )}
          </div>

          {fallback && (
            <textarea className="input words code-out" value={fallback} rows={5} readOnly />
          )}
        </>
      )}
    </div>
  );
}

/** The part of a word that matched, marked so the eye lands on it. */
function Marked({ text, query }) {
  const at = matchAt(text, query);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}
