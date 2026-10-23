import { useCallback, useEffect, useState } from 'react';
import { EMPTY_HISTORY, PHASE, createGame, reduce } from '../../core/engine.js';
import { useErrorText, useT } from '../../i18n/index.jsx';
import PackEditor from '../../features/packs/PackEditor.jsx';
import PackLibrary from '../../features/packs/PackLibrary.jsx';
import { PACK_LIMITS } from '../../content/words/custom.js';
import { loadPacks, savePacks } from '../../features/packs/store.js';
import { Announce, Banner, Shell } from '../../ui/primitives/index.js';
import { EndGameButton } from '../../features/lobby/index.js';
import { GameOverCard, VerdictCard } from '../../features/round/index.js';
import { Lobby} from './screens/Lobby.jsx';
import { Resume} from './screens/Resume.jsx';
import { Reveal} from './screens/Reveal.jsx';
import { Steal} from './screens/Steal.jsx';
import { Talking} from './screens/Talking.jsx';
import { Voting} from './screens/Voting.jsx';
export { CONFIG_KEY, GAME_KEY, RECENT_WORDS_KEY, ROSTER_KEY, SCORES_KEY } from './storage.js';
import { clearGame, loadConfig, loadGame, loadRecentWords, loadRoster, loadScores, saveConfig, saveGame, saveRecentWords, saveRoster, saveScores} from './storage.js';
import { describe, keepQuiet, note } from '../../features/errors/index.js';
import { isPlaying, renderPhase } from '../screens.js';

/**
 * Pass-and-play: one phone, handed around the table.
 *
 * The whole game lives in this browser — there is no server involved. The only
 * thing that matters here is privacy: between one player's card and the next,
 * a gate screen covers the screen so nobody sees a card that is not theirs,
 * and opening a card takes a deliberate press-and-hold rather than a tap.
 */

export default function LocalGame({ onExit }) {
  const { t, lang } = useT();
  const errorText = useErrorText();

  const [state, setState] = useState(() => {
    // Default the word language to whatever the interface is in — most people
    // want words in the language they are reading the buttons in.
    let s = createGame(
      { wordLang: lang, ...(loadConfig() ?? {}) },
      { ...EMPTY_HISTORY, words: loadRecentWords() },
    );
    for (const name of loadRoster()) {
      try {
        s = reduce(s, { type: 'ADD_PLAYER', name });
      } catch {
        /* skip anything that no longer validates */
      }
    }
    // The roster has to exist before the points can be matched back to it.
    return { ...s, scores: loadScores(s.players), customPacks: loadPacks() };
  });
  const [error, setError] = useState(null);
  const [holding, setHolding] = useState(false); // has the next player taken the phone?

  /**
   * A game this phone was in the middle of when it last closed.
   *
   * It is offered rather than restored. Somebody who reloaded by accident
   * wants it back; somebody who closed the tab last Tuesday and is setting up
   * a new table does not, and silently dealing them a week-old round with
   * last week's players in it would be its own kind of broken.
   */
  const [interrupted, setInterrupted] = useState(() => loadGame());
  const resume = () => {
    setState({ ...interrupted, customPacks: loadPacks() });
    setInterrupted(null);
  };
  const startFresh = () => {
    clearGame();
    setInterrupted(null);
  };

  const run = useCallback((action) => {
    setError(null);
    // The name of what was asked for, never what was in it: a trail of these
    // is enough to see how a screen reached the state it broke in, and there
    // is nothing in it that could give a word away.
    note(action.type);
    setState((current) => {
      try {
        return reduce(current, action);
      } catch (err) {
        setError(err);
        return current;
      }
    });
  }, []);

  useEffect(() => {
    if (state.phase === PHASE.LOBBY) saveRoster(state.players);
  }, [state.phase, state.players]);

  useEffect(() => {
    saveRecentWords(state.history.words);
  }, [state.history.words]);

  useEffect(() => {
    saveScores(state.players, state.scores);
  }, [state.players, state.scores]);

  useEffect(() => {
    saveConfig(state.config);
  }, [state.config]);

  useEffect(() => {
    savePacks(state.customPacks);
  }, [state.customPacks]);

  /**
   * Write the round down after every action.
   *
   * While the offer above is still on screen this has to keep its hands off:
   * the fresh lobby state it would save over the top is exactly the thing
   * the player has not chosen yet.
   */
  useEffect(() => {
    if (interrupted) return;
    if (isPlaying(state.phase)) saveGame(state);
    else clearGame();
  }, [state, interrupted]);

  // Which pack the editor is open on: an id, null for a new one, or false
  // for closed. A pack is only a screen away from the settings that lists it.
  const [editing, setEditing] = useState(false);
  // …and the library, which is the same shelf with every pack on it.
  const [browsing, setBrowsing] = useState(false);

  // Every phase change hands the phone to someone new, so close the gate.
  useEffect(() => {
    setHolding(false);
  }, [state.phase, state.round]);

  // What a crash report must leave out, and what it may say. Both follow the
  // game rather than being set once: the word changes every round, and a
  // report from the lobby should not claim to be from a vote.
  useEffect(() => {
    keepQuiet([state.secretWord, state.imposterWord].filter(Boolean));
    describe({
      wordLang: state.config.wordLang,
      mode: 'one phone',
      phase: state.phase,
      players: state.players.length,
    });
    // Leaving the game takes the game out of the description: a report from
    // the home screen should not claim to be from round three.
    return () => describe({ mode: null, phase: null, players: null, wordLang: null });
  }, [state.secretWord, state.imposterWord, state.phase, state.players.length, state.config.wordLang]);

  const savePack = (pack) => {
    const others = state.customPacks.filter((p) => p.id !== pack.id);
    if (others.length >= PACK_LIMITS.packs) {
      setError({ code: 'packTooMany' });
      return;
    }
    run({ type: 'SET_CUSTOM_PACKS', packs: [...others, pack] });
    // A pack you just wrote is a pack you meant to play with.
    if (!state.config.packIds.includes(pack.id) && state.config.packIds.length > 0) {
      run({ type: 'SET_CONFIG', config: { packIds: [...state.config.packIds, pack.id] } });
    }
    setEditing(false);
  };

  const deletePack = (id) => {
    run({ type: 'SET_CUSTOM_PACKS', packs: state.customPacks.filter((p) => p.id !== id) });
    run({
      type: 'SET_CONFIG',
      config: { packIds: state.config.packIds.filter((packId) => packId !== id) },
    });
    setEditing(false);
  };

  const body = (() => {
    if (browsing) {
      return (
        <PackLibrary
          lang={state.config.wordLang}
          customPacks={state.customPacks}
          onEdit={(id) => {
            setBrowsing(false);
            setEditing(id);
          }}
          onClose={() => setBrowsing(false)}
        />
      );
    }
    if (editing !== false) {
      return (
        <PackEditor
          pack={state.customPacks.find((p) => p.id === editing) ?? null}
          lang={state.config.wordLang}
          onSave={savePack}
          onDelete={deletePack}
          onClose={() => setEditing(false)}
        />
      );
    }
    // Which screen goes with which phase is shared with the online mode, so
    // a new phase is one edit rather than two. See ../screens.js.
    return renderPhase(state.phase, {
      lobby: () => (
        <Lobby
          state={state}
          run={run}
          onEditPack={setEditing}
          onBrowsePacks={() => setBrowsing(true)}
        />
      ),
      reveal: () => <Reveal state={state} run={run} holding={holding} setHolding={setHolding} />,
      clues: () => <Talking state={state} run={run} />,
      vote: () => <Voting state={state} run={run} />,
      verdict: () => <VerdictCard state={state} onContinue={() => run({ type: 'CONTINUE' })} />,
      steal: () => <Steal state={state} run={run} holding={holding} setHolding={setHolding} />,
      gameOver: () => <GameOverCard state={state} onPlayAgain={() => run({ type: 'PLAY_AGAIN' })} />,
    });
  })();

  const playing = isPlaying(state.phase);

  return (
    <Shell onBack={state.phase === PHASE.LOBBY ? onExit : undefined} phase={state.phase}>
      {interrupted && <Resume game={interrupted} onResume={resume} onFresh={startFresh} />}
      <Announce>{t(`step.${state.phase === PHASE.CLUES ? 'clues' : 'result'}`)}</Announce>
      {error && <Banner kind="error">{errorText(error)}</Banner>}
      {body}
      {playing && <EndGameButton onEnd={() => run({ type: 'RESET' })} />}
    </Shell>
  );
}
