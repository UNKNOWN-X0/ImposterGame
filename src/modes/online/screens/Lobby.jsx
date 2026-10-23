/**
 * The room before the deal. Everybody watches; only the host decides.
 */

import { MIN_PLAYERS } from '../../../core/engine.js';
import { useWords } from '../../../features/packs/useWords.js';
import { useT } from '../../../i18n/index.jsx';
import { LobbyHint, PlayerList, Scoreboard, Settings, WinValues } from '../../../features/lobby/index.js';

/* ------------------------------------------------------------------ */

export function OnlineLobby({ payload, act, myPacks = [], onEditPack, onBrowsePacks }) {
  const { t } = useT();
  const { state, isHost, you, code } = payload;
  // The words are fetched per language. The server is the one that deals, so
  // this is not about the deal working — it is about the settings panel
  // showing real pack names and counts rather than an empty shelf.
  const haveWords = useWords(state.config.wordLang);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ready = state.players.length >= MIN_PLAYERS;

  return (
    <div className="stack">
      <div className="card center stack tight">
        <div className="eyebrow">{t('room.code')}</div>
        <div className="big-word code-word">{code}</div>
        <p className="hint">
          {t('room.howTo', { host: origin.replace(/^https?:\/\//, '') })}
        </p>
      </div>

      <PlayerList
        players={state.players}
        youId={you}
        hostId={payload.hostId}
        onRemove={isHost ? (id) => act({ type: 'REMOVE_PLAYER', playerId: id }) : undefined}
      />
      <LobbyHint count={state.players.length} />

      {/* Everybody watches the scoreboard; only the host can wipe it. */}
      {state.config.scoring && (
        <Scoreboard
          players={state.players}
          scores={state.scores}
          onClear={isHost ? () => act({ type: 'CLEAR_SCORES' }) : undefined}
        />
      )}

      {state.config.scoring && <WinValues />}

      {isHost ? (
        <>
          <Settings
            config={state.config}
            playerCount={state.players.length}
            customPacks={myPacks}
            onEditPack={onEditPack}
            onBrowsePacks={onBrowsePacks}
            onChange={(config) => act({ type: 'SET_CONFIG', config })}
          />
          <button
            className="btn primary block lg"
            disabled={!ready || !haveWords}
            onClick={() => act({ type: 'START_GAME' })}
          >
            {haveWords ? t('lobby.deal') : t('lobby.fetchingWords')}
          </button>
        </>
      ) : (
        <p className="hint center dots">{t('room.waitingHost')}</p>
      )}
    </div>
  );
}
