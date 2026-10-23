/**
 * How a round ends, and how a game does.
 */

import { useState } from 'react';
import { SPECIAL_ROLES } from '../../core/engine.js';
import { BellIcon, BrokenIcon, Confetti, DiceIcon, HourglassIcon, ImposterIcon, JesterIcon, TargetIcon, TieIcon, TrophyIcon } from '../../ui/icons/index.jsx';
import { useT } from '../../i18n/index.jsx';
import { PlayerList } from '../lobby/PlayerList.jsx';
import { Scoreboard } from '../lobby/Scoreboard.jsx';
import { hintLine } from '../lobby/Settings.jsx';
import { PackChip } from '../packs/PackChip.jsx';
import { Tally } from './Voting.jsx';
import { Rich } from '../../ui/primitives/Rich.jsx';

export function VerdictCard({ state, onContinue, canContinue = true }) {
  const { t } = useT();
  const { lastVote, players } = state;
  const who = players.find((p) => p.id === lastVote?.eliminatedId);

  // A caught imposter and a lost crew member are not the same news, so they
  // do not arrive the same way: one locks on, the other knocks the card.
  const miss = Boolean(who) && !lastVote?.tied && !lastVote?.wasImposter;
  const hit = Boolean(who) && !lastVote?.tied && lastVote?.wasImposter;

  return (
    <div className="stack">
      <div className={`card pad-lg center stack stamp${hit ? ' hit' : ''}${miss ? ' miss' : ''}`}>
        {lastVote?.called && who ? (
          // Not a vote at all: this imposter called the word and missed.
          <>
            <span className="glyph danger">
              <BellIcon size={30} />
            </span>
            <h2 className="title">{t('verdict.isOut', { name: who.name })}</h2>
            <p className="subtitle">{t('call.wrong', { name: who.name })}</p>
          </>
        ) : lastVote?.tied || !who ? (
          <>
            <span className="glyph">
              <TieIcon size={30} anim />
            </span>
            <h2 className="title">{t('verdict.nobody')}</h2>
            <p className="subtitle">{t('verdict.split')}</p>
          </>
        ) : (
          <>
            <span className={`glyph ${lastVote.wasImposter ? 'good' : 'danger'}`}>
              {lastVote.wasImposter ? <TargetIcon size={30} anim /> : <BrokenIcon size={30} anim />}
            </span>
            <h2 className="title">{t('verdict.isOut', { name: who.name })}</h2>
            <p className="subtitle">
              <Rich
                text={
                  // A special role is worth naming — finding the detective is
                  // not the same news as finding a crew member, and the table
                  // has earned the difference.
                  SPECIAL_ROLES.includes(lastVote.role)
                    ? t('verdict.wasRole', { role: t(`role.${lastVote.role}`) })
                    : lastVote.wasImposter
                      ? t('verdict.wasImposter')
                      : t('verdict.wasCrew')
                }
              />
            </p>
          </>
        )}
        {!lastVote?.declared && Object.keys(lastVote?.counts || {}).length > 0 && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <Tally counts={lastVote.counts} players={players} />
          </div>
        )}
      </div>

      {canContinue ? (
        <button className="btn primary block lg" onClick={onContinue}>
          {t('common.continue')}
        </button>
      ) : (
        <p className="hint center dots">{t('verdict.waitingHost')}</p>
      )}
    </div>
  );
}

export function StealCard({ onGuess, canGuess, imposterNames = [] }) {
  const { t } = useT();
  const [text, setText] = useState('');

  if (!canGuess) {
    return (
      <div className="card pad-lg center stack">
        <span className="glyph">
          <HourglassIcon size={30} anim />
        </span>
        <h2 className="title">{t('steal.waitTitle')}</h2>
        <p className="subtitle dots">
          {t('steal.waiting', {
            names: imposterNames.length ? imposterNames.join(' & ') : t('steal.theImposter'),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="card pad-lg stack">
      <div className="center stack tight">
        <span className="glyph danger">
          <DiceIcon size={30} anim />
        </span>
        <h2 className="title">{t('steal.title')}</h2>
        <p className="subtitle">{t('steal.sub')}</p>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          onGuess(text.trim());
        }}
      >
        <input
          className="input grow"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('steal.placeholder')}
          autoCapitalize="none"
          autoComplete="off"
        />
        <button className="btn danger" disabled={!text.trim()}>
          {t('steal.guess')}
        </button>
      </form>
    </div>
  );
}

export function GameOverCard({ state, onPlayAgain, canRestart = true }) {
  const { t } = useT();
  const { result, secretWord, imposterWord, imposterIds, players, stealGuess, call } = state;
  const crewWon = result?.winner === 'crew';
  const jesterWon = result?.winner === 'jester';
  const imposterCount = imposterIds.length;
  const caller = call && players.find((p) => p.id === call.playerId);

  const headline = jesterWon
    ? t('over.jesterWin')
    : result?.reason === 'cleanSweep'
      ? t('over.cleanSweep')
      : crewWon
        ? t('over.crewWin')
        : result?.reason === 'steal'
          ? t('over.stolen')
          : result?.reason === 'called'
            ? t('over.called')
            : result?.reason === 'time'
              ? t('over.survive')
              : t('over.imposterWin');

  return (
    <div className="stack">
      <div
        className={`card pad-lg center stack celebrate ${
          jesterWon ? 'win-wild' : crewWon ? 'win-crew' : 'win-imposter'
        }`}
      >
        {/* The jester gets confetti too. Winning by losing is still winning,
            and it is the funniest way this game ends. */}
        {(crewWon || jesterWon) && <Confetti />}
        <span className={`glyph big ${jesterWon ? 'wild' : crewWon ? 'good' : 'danger'}`}>
          {jesterWon ? (
            <JesterIcon size={38} anim />
          ) : crewWon ? (
            <TrophyIcon size={38} anim />
          ) : (
            <ImposterIcon size={38} anim />
          )}
        </span>
        <h2 className="title">{headline}</h2>
        <p className="subtitle">{t(`over.reason.${result?.reason}`)}</p>
      </div>

      <div className="card stack tight center">
        <div className="eyebrow">{t('over.wordWas')}</div>
        <div className="big-word">{secretWord}</div>
        <PackChip
          lang={state.config.wordLang}
          packId={state.packId}
          customPacks={state.customPacks}
        />
        {imposterWord && <p className="hint">{t('over.imposterSaw', { word: imposterWord })}</p>}
        {!imposterWord && state.imposterHint && (
          <p className="hint">
            {t('over.imposterHint', { hint: hintLine(t, state.imposterHint) })}
          </p>
        )}
        {call && caller && (
          <p className="hint">{t('over.calledIt', { name: caller.name, guess: call.text })}</p>
        )}
        {stealGuess && (
          <p className="hint">
            {t('over.finalGuess', {
              guess: stealGuess.text,
              verdict: stealGuess.correct ? t('over.correct') : t('over.wrong'),
            })}
          </p>
        )}
      </div>

      <div className="stack tight">
        <div className="eyebrow">
          {imposterCount === 1 ? t('over.theImposter') : t('over.theImposters')}
        </div>
        <PlayerList
          players={players}
          imposterIds={imposterIds}
          roles={state.roles}
          eliminated={state.eliminated}
        />
      </div>

      {state.config.scoring && (
        <Scoreboard
          players={players}
          scores={state.scores}
          gained={state.lastWinners ?? []}
          award={state.lastAward ?? 1}
        />
      )}

      {canRestart ? (
        <button className="btn primary block lg" onClick={onPlayAgain}>
          {t('over.playAgain')}
        </button>
      ) : (
        <p className="hint center dots">{t('over.waitingHost')}</p>
      )}
    </div>
  );
}

