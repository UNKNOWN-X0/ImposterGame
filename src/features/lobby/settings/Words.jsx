/**
 * Which language the words come from, and which packs are in play.
 *
 * These two are the whole content of a round, so they carry the count of how
 * many words the table has left itself: a setting and its consequence in the
 * same place.
 */

import { Info } from '../../../ui/primitives/Info.jsx';
import { PencilIcon, PlusIcon } from '../../../ui/icons/index.jsx';
import { Segmented } from '../../../ui/primitives/Segmented.jsx';
import { WORD_LANGUAGES } from '../../../content/words/index.js';

export function WordLanguage({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting block">
      <div className="label">
        <b>
          {t('settings.wordLang')} <Info text={t('tip.wordLang')} />
        </b>
        <span>{t('settings.wordLangHint')}</span>
      </div>
      <Segmented wide>
        {WORD_LANGUAGES.map((l) => (
          <button
            key={l.id}
            aria-pressed={wordLang === l.id}
            disabled={disabled}
            onClick={() => onChange({ wordLang: l.id })}
          >
            <span aria-hidden="true">{l.flag}</span> {l.label}
          </button>
        ))}
      </Segmented>
    </div>
  );
}

export function Packs({ t, config, onChange, disabled, seats, cap, blind, wordLang, packs, myPacks, packIds, allPacks, roles, words, togglePack, onEditPack, onBrowsePacks, customPacks }) {
  return (
    <div className="setting block">
      <div className="label" style={{ marginBottom: 10 }}>
        <b>
          {t('settings.packs')} <Info text={t('tip.packs')} />
        </b>
        <span>
          {allPacks
            ? t('settings.packsAll', { count: words })
            : t('settings.packsSome', { count: words })}
        </span>
      </div>
      <div className="pack-grid">
        {packs.map((pack) =>
          // A pack the table wrote keeps its pencil beside it, so the chip
          // that selects it and the button that opens it read as one thing
          // rather than as the same pack listed twice.
          pack.custom ? (
            <span className="pack-pair" key={pack.id}>
              <button
                className="pack own"
                aria-pressed={allPacks || packIds.includes(pack.id)}
                disabled={disabled}
                onClick={() => togglePack(pack.id)}
              >
                <span aria-hidden="true">{pack.emoji}</span> {pack.name}
              </button>
              {onEditPack && (
                <button
                  className="pack-edit"
                  disabled={disabled}
                  aria-label={`${t('packs.edit')} — ${pack.name}`}
                  onClick={() => onEditPack(pack.id)}
                >
                  <PencilIcon size={14} />
                </button>
              )}
            </span>
          ) : (
            <button
              key={pack.id}
              className="pack"
              aria-pressed={allPacks || packIds.includes(pack.id)}
              disabled={disabled}
              onClick={() => togglePack(pack.id)}
            >
              <span aria-hidden="true">{pack.emoji}</span> {pack.name}
            </button>
          ),
        )}
      </div>

      {onEditPack && (
        <div className="row wrap" style={{ marginTop: 12 }}>
          <button className="btn sm grow" disabled={disabled} onClick={() => onEditPack(null)}>
            <PlusIcon size={16} /> {t('packs.add')}
          </button>
          {/* Twelve taps to turn the other packs off is not a setting, it
              is a chore — and "tonight we play only our words" is the
              whole reason somebody wrote a pack. */}
          {myPacks.length > 0 && (
            <button
              className="btn sm ghost"
              disabled={disabled}
              onClick={() => onChange({ packIds: myPacks.map((pack) => pack.id) })}
            >
              {t('packs.only')}
            </button>
          )}
        </div>
      )}

      {/* A chip says a pack's name. Somebody wondering whether the word
          they are about to deal is in it needs to open the pack. */}
      {onBrowsePacks && (
        <button className="btn-link" onClick={onBrowsePacks}>
          {t('library.open')}
        </button>
      )}
    </div>
  );
}
