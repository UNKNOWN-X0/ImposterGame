/**
 * The card itself, and the hand-over before it.
 */

import { useState } from 'react';
import { CardBackIcon, EyeIcon, HintIcon, HoldRing, PassIcon, UnknownIcon } from '../../ui/icons/index.jsx';
import { ROLE } from '../../core/engine.js';
import { useT } from '../../i18n/index.jsx';
import { hintLine } from '../lobby/Settings.jsx';
import { PackChip } from '../packs/PackChip.jsx';
import { HoldCard } from '../../ui/primitives/HoldCard.jsx';
import { Rich } from '../../ui/primitives/Rich.jsx';
import { ROLE_FACE } from '../../ui/primitives/RoleGlyph.jsx';

export function RoleCard({ view, name, onDone, doneLabel, wordLang, customPacks = [] }) {
  const { t } = useT();
  const [shown, setShown] = useState(false);
  const imposter = view.role === ROLE.IMPOSTER;
  // In blind mode the card must give nothing away: no colour, no label, just
  // a word. Everyone's card looks identical, which is the whole point.
  const blind = view.role === 'unknown';
  const face = ROLE_FACE[view.role] ?? ROLE_FACE[ROLE.CREW];
  const tone = blind ? 'neutral' : face.tone;

  return (
    <div className="stack fill">
      {!shown ? (
        <HoldCard onOpen={() => setShown(true)}>
          {(progress) => (
            <div className="stack tight center">
              <div className="card-face" aria-hidden="true">
                <HoldRing progress={progress} />
                <span className="card-face-icon">
                  {progress > 0 ? <EyeIcon size={30} anim /> : <CardBackIcon size={30} anim />}
                </span>
              </div>
              {name && <div className="title">{name}</div>}
              <div className={`subtitle${progress > 0 ? '' : ' pulse'}`}>
                {progress > 0 ? t('reveal.holding') : t('reveal.hold')}
              </div>
              <div className="hint">{t('reveal.makeSure')}</div>
            </div>
          )}
        </HoldCard>
      ) : (
        <div className={`reveal ${tone} card-flip-in`}>
          <div className="stack tight center">
            <span className="glyph role settle" aria-hidden="true">
              {blind ? (
                <UnknownIcon size={26} anim />
              ) : imposter && view.hint ? (
                <HintIcon size={26} anim />
              ) : (
                <face.icon size={26} anim={view.role !== ROLE.CREW} />
              )}
            </span>
            <div className="role-name">
              {blind
                ? t('reveal.blind')
                : imposter && view.hint
                  ? t('reveal.hintLabel')
                  : t(face.label)}
            </div>
            {view.word ? (
              <>
                <div className="big-word word-in">{view.word}</div>
                <PackChip lang={wordLang} packId={view.packId} customPacks={customPacks} />
                <div className="hint">
                  {blind
                    ? t('reveal.blindHint')
                    : imposter
                      ? t('reveal.imposterHint')
                      : t('reveal.crewHint')}
                </div>
              </>
            ) : view.hint ? (
              // Hint mode: no word at all, a description of one instead.
              <>
                <div className="hint-line word-in">{hintLine(t, view.hint)}</div>
                <PackChip lang={wordLang} packId={view.packId} customPacks={customPacks} />
                <div className="hint">{t('reveal.hintHelp')}</div>
              </>
            ) : (
              <>
                <div className="big-word">{t('reveal.noWord')}</div>
                <PackChip lang={wordLang} packId={view.packId} customPacks={customPacks} />
                <div className="hint">{t('reveal.noWordHint')}</div>
              </>
            )}
            {view.role === ROLE.DETECTIVE && (
              <div className="banner" style={{ marginTop: 10 }}>
                <Rich
                  text={
                    view.cleared
                      ? t('role.detectiveKnows', { name: view.cleared })
                      : t('role.detectiveAlone')
                  }
                />
              </div>
            )}

            {view.role === ROLE.SIDEKICK && view.knownImposters?.length > 0 && (
              <div className="banner" style={{ marginTop: 10 }}>
                <Rich
                  text={t('role.sidekickKnows', {
                    names: view.knownImposters.join(' & '),
                  })}
                />
              </div>
            )}

            {view.role === ROLE.JESTER && (
              <div className="banner" style={{ marginTop: 10 }}>
                {t('role.jesterGoal')}
              </div>
            )}

            {view.fellowImposters?.length > 0 && (
              <div className="banner" style={{ marginTop: 10 }}>
                <Rich
                  text={t('reveal.workingWith', {
                    names: `<b>${view.fellowImposters.join(' & ')}</b>`,
                  })}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {shown && (
        <button className="btn primary block lg" onClick={onDone}>
          {doneLabel ?? t('common.gotIt')}
        </button>
      )}
    </div>
  );
}

/** The "hand the phone over" gate that keeps cards private on one device. */
export function PassGate({ name, onReady, note }) {
  const { t } = useT();
  return (
    <button className="reveal shield" onClick={onReady}>
      <div className="stack tight center">
        <span className="glyph">
          <PassIcon size={30} anim />
        </span>
        <div className="eyebrow">{t('reveal.passTo')}</div>
        {/* A name with no space in it used to push this card wider than the
            screen, and because the stack centres on the overflowed box the
            icon, the eyebrow and the name all drifted a few pixels right of
            the heading above them. Long names break instead. */}
        <div className="title break-anywhere">{name}</div>
        {/* The note says what the screen is for; the tap line says what to do
            about it. Passing a note used to replace the instruction, so the
            steal hand-off — the same striped card, needing the same tap —
            had nothing on it telling anybody to tap. */}
        {note && <div className="hint">{note}</div>}
        <div className="hint">{t('reveal.tapWhenHolding')}</div>
      </div>
    </button>
  );
}

