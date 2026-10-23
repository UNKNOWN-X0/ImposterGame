/**
 * Before the cards go out: who is here, what the night has cost so far, and
 * every setting the table can change.
 */

import { MAX_PLAYERS, MIN_PLAYERS } from '../../../core/engine.js';
import { useT } from '../../../i18n/index.jsx';
import { AddPlayerForm, LobbyHint, PlayerList, Scoreboard, Settings, WinValues } from '../../../features/lobby/index.js';
import { useWords } from '../../../features/packs/useWords.js';

/* ------------------------------------------------------------------ *
 * Lobby
 * ------------------------------------------------------------------ */

export function Lobby({ state, run, onEditPack, onBrowsePacks }) {
  const { t } = useT();
  // The words for this language are fetched rather than bundled, so a table
  // that has just switched language waits a moment. Almost always already
  // true by the time anybody has finished typing in names.
  const haveWords = useWords(state.config.wordLang);
  const ready = state.players.length >= MIN_PLAYERS && haveWords;
  return (
    <div className="stack">
      <div className="stack tight">
        <h1 className="title">{t('lobby.title')}</h1>
        <p className="subtitle">{t('lobby.sub')}</p>
      </div>

      <AddPlayerForm
        onAdd={(name) => run({ type: 'ADD_PLAYER', name })}
        disabled={state.players.length >= MAX_PLAYERS}
      />

      <PlayerList
        players={state.players}
        onRemove={(id) => run({ type: 'REMOVE_PLAYER', playerId: id })}
      />
      <LobbyHint count={state.players.length} />

      {state.config.scoring && (
        <Scoreboard
          players={state.players}
          scores={state.scores}
          onClear={() => run({ type: 'CLEAR_SCORES' })}
        />
      )}

      {state.config.scoring && <WinValues />}

      <Settings
        config={state.config}
        playerCount={state.players.length}
        customPacks={state.customPacks}
        onEditPack={onEditPack}
        onBrowsePacks={onBrowsePacks}
        onChange={(config) => run({ type: 'SET_CONFIG', config })}
      />

      <button
        className="btn primary block lg"
        disabled={!ready}
        onClick={() => run({ type: 'START_GAME' })}
      >
        {haveWords ? t('lobby.deal') : t('lobby.fetchingWords')}
      </button>
    </div>
  );
}
