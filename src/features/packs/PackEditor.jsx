/**
 * Writing a pack, and passing it on.
 *
 * The best words at any table are the ones nobody else could have written —
 * the road they live on, the bar they argue about, the thing their friend
 * says too often. This is where those get in.
 *
 * Paste a list, watch it be understood line by line, save it. A pack is kept
 * on the device that wrote it, and travels to anybody else as one long code
 * they paste into the same box.
 */

import { useMemo, useState } from 'react';
import { lintPack } from '../../content/words/lint.js';

import {
  buildPack,
  decodePack,
  encodePack,
  parsePairs,
  toText,
  PACK_LIMITS,
} from '../../content/words/custom.js';
import { WORD_LANGUAGES } from '../../content/words/index.js';
import { useT, useErrorText } from '../../i18n/index.jsx';
import { CheckIcon, CopyIcon } from '../../ui/icons/index.jsx';

const EMOJI = ['✏️', '🏠', '💼', '🎬', '🎵', '🍜', '⚽️', '🐈', '🌏', '🎉', '💀', '🧠'];

/**
 * @param pack     the pack being edited, or null for a new one
 * @param lang     the word language it will belong to
 * @param onSave   called with a finished pack
 * @param onDelete called with the id of a pack being thrown away
 */
export default function PackEditor({ pack, lang, onSave, onDelete, onClose }) {
  const { t } = useT();
  const errorText = useErrorText();
  const [name, setName] = useState(pack?.name ?? '');
  const [emoji, setEmoji] = useState(pack?.emoji ?? EMOJI[0]);
  const [text, setText] = useState(pack ? toText(pack.pairs) : '');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [shareCode, setShareCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-read on every keystroke: the whole point is watching the list turn
  // into a pack as it is pasted, rather than finding out on save.
  const { pairs, skipped } = useMemo(() => parsePairs(text), [text]);
  /**
   * Pairs that parse but would not play.
   *
   * A near miss that is the word, or the same word with an ending on it,
   * reads perfectly well in a list and ends a round before the first clue.
   * These are warnings rather than refusals: it is somebody's pack, and they
   * may know something the rules do not.
   */
  const warnings = useMemo(
    () => lintPack({ lang, hint: name, pairs }).slice(0, 6),
    [lang, name, pairs],
  );
  const withMiss = pairs.filter((p) => p.decoy).length;
  const langName = WORD_LANGUAGES.find((l) => l.id === lang)?.label ?? lang;

  const save = () => {
    const built = buildPack({ id: pack?.id, name, emoji, lang, text });
    if (built.error) {
      setError({ code: built.error, params: built.params });
      return;
    }
    onSave(built.pack);
  };

  const load = () => {
    const loaded = decodePack(code);
    if (!loaded) {
      setError({ code: 'packBadCode' });
      return;
    }
    // Fill the form rather than saving straight away: somebody pasting a
    // code from a friend should see what they are about to keep.
    setName(loaded.name);
    setEmoji(loaded.emoji);
    setText(toText(loaded.pairs));
    setCode('');
    setError(null);
    setNote(t('packs.loaded', { name: loaded.name, count: loaded.pairs.length }));
  };

  const share = async () => {
    const built = buildPack({ id: pack?.id, name, emoji, lang, text });
    if (built.error) {
      setError({ code: built.error, params: built.params });
      return;
    }
    const value = encodePack(built.pack);
    setShareCode(value);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no clipboard — the code is on screen to copy by hand */
    }
  };

  return (
    <div className="stack">
      <div className="stack tight">
        <h1 className="title">{pack ? t('packs.edit') : t('packs.new')}</h1>
        <p className="hint">{t('packs.langNote', { lang: langName })}</p>
      </div>

      {error && <div className="banner error">{errorText(error)}</div>}
      {note && <div className="banner">{note}</div>}

      <div className="card stack">
        <label className="stack tight">
          <span className="eyebrow">{t('packs.name')}</span>
          <input
            className="input"
            value={name}
            maxLength={PACK_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('packs.namePlaceholder')}
            autoComplete="off"
          />
        </label>

        <div className="stack tight">
          <span className="eyebrow">{t('packs.emoji')}</span>
          <div className="emoji-grid">
            {EMOJI.map((option) => (
              <button
                key={option}
                className="emoji-pick"
                aria-pressed={emoji === option}
                aria-label={option}
                onClick={() => setEmoji(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card stack tight">
        <span className="eyebrow">{t('packs.words')}</span>
        <p className="hint">{t('packs.wordsHelp')}</p>
        <textarea
          className="input words"
          value={text}
          rows={10}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('packs.wordsPlaceholder')}
          spellCheck="false"
          autoCapitalize="none"
        />
        <div className="row wrap counts">
          <span className={`tag${pairs.length >= PACK_LIMITS.minPairs ? ' crew' : ''}`}>
            {t('packs.count', { count: pairs.length })}
          </span>
          {withMiss > 0 && <span className="tag">{t('packs.withMiss', { count: withMiss })}</span>}
          {skipped.length > 0 && (
            <span className="tag imposter">{t('packs.skipped', { count: skipped.length })}</span>
          )}
          {warnings.length > 0 && (
            <span className="tag">{t('packs.warned', { count: warnings.length })}</span>
          )}
        </div>
        {skipped.length > 0 && (
          <ul className="skipped">
            {skipped.slice(0, 6).map((s) => (
              <li key={`${s.at}-${s.why}`}>{t(`packs.skipped.${s.why}`, { at: s.at })}</li>
            ))}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="skipped">
            {warnings.map((w) => (
              <li key={`${w.at}-${w.why}`}>{t(`packs.warn.${w.why}`, w)}</li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn primary block lg" onClick={save}>
        {t('packs.save')}
      </button>

      <div className="card stack tight">
        <span className="eyebrow">{t('packs.load')}</span>
        <div className="row">
          <input
            className="input grow"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('packs.loadPlaceholder')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
          />
          <button className="btn" disabled={!code.trim()} onClick={load}>
            {t('packs.loadButton')}
          </button>
        </div>
      </div>

      <div className="card stack tight">
        <span className="eyebrow">{t('packs.shareTitle')}</span>
        <p className="hint">{t('packs.shareBody')}</p>
        {shareCode ? (
          <>
            <textarea className="input words code-out" value={shareCode} rows={3} readOnly />
            <button className="btn block" onClick={share}>
              {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}{' '}
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </>
        ) : (
          <button className="btn block" onClick={share}>
            {t('packs.share')}
          </button>
        )}
      </div>

      {pack && onDelete && (
        <div className="center stack tight">
          {confirmDelete ? (
            <>
              <p className="hint">{t('packs.deleteSure')}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn danger sm" onClick={() => onDelete(pack.id)}>
                  {t('packs.delete')}
                </button>
                <button className="btn sm ghost" onClick={() => setConfirmDelete(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </>
          ) : (
            <button className="btn-link" onClick={() => setConfirmDelete(true)}>
              {t('packs.delete')}
            </button>
          )}
        </div>
      )}

      <button className="btn-link" onClick={onClose}>
        {t('common.back')}
      </button>
    </div>
  );
}
