import { useEffect, useRef, useState } from 'react';
import { PHASE } from '../../core/engine.js';
import { useErrorText, useT } from '../../i18n/index.jsx';
import PackEditor from '../../features/packs/PackEditor.jsx';
import PackLibrary from '../../features/packs/PackLibrary.jsx';
import { loadPacks, savePacks } from '../../features/packs/store.js';
import { PACK_LIMITS } from '../../content/words/custom.js';
import { leaveRoom, loadSession, useRoom } from './useRoom.js';
import { Announce, Banner, Shell } from '../../ui/primitives/index.js';
import { GameOverCard, StealCard, VerdictCard } from '../../features/round/index.js';
import { JoinScreen} from './JoinScreen.jsx';
import { OnlineClues} from './screens/Clues.jsx';
import { OnlineLobby} from './screens/Lobby.jsx';
import { OnlineReveal} from './screens/Reveal.jsx';
import { OnlineVote} from './screens/Vote.jsx';
import { describe, keepQuiet, note } from '../../features/errors/index.js';
import { renderPhase } from '../screens.js';

/**
 * LAN play: everyone on their own phone, same wifi.
 *
 * This component renders whatever the server last told it and posts actions
 * back. It deliberately holds no rules of its own — if it looks like a
 * decision is being made here, it belongs in the engine.
 *
 * Note that the interface language is a per-device choice, while the language
 * the words come from belongs to the game and is set by the host. Two players
 * at one table can read different buttons and still guess the same word.
 */

export default function OnlineGame({ onExit, initialCode = '' }) {
  const [session, setSession] = useState(() => loadSession());

  if (!session) {
    return (
      <JoinScreen onExit={onExit} initialCode={initialCode} onJoined={(s) => setSession(s)} />
    );
  }

  return (
    <Room
      session={session}
      onLeave={() => {
        // Told, not guessed: the server has no way to tell a phone that left
        // from one that locked its screen, and the room needs to know so it
        // can hand on the crown rather than wait for a host who is not
        // coming back. The screen does not wait for the answer.
        leaveRoom(session);
        setSession(null);
      }}
      onExit={onExit}
    />
  );
}

/* ------------------------------------------------------------------ *
 * In a room
 * ------------------------------------------------------------------ */

function Room({ session, onLeave, onExit }) {
  const { t } = useT();
  const errorText = useErrorText();
  const { payload, connection, error, act, reconnect } = useRoom(session);

  /**
   * The host's own packs, from their phone.
   *
   * A room deals from the host's packs, so the room needs the words — and
   * only the room: the server strips them back out of everything it sends
   * to the players, who get the pack's name and nothing else. Guests never
   * load their own packs into a room they did not open; whoever deals sets
   * the words, the same as every other setting.
   */
  const [myPacks, setMyPacks] = useState(loadPacks);
  const [editing, setEditing] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const isHost = payload?.isHost ?? false;

  /**
   * What a crash report from this phone may say, and what it must not.
   *
   * On a guest's phone the word is whatever the server sent this player —
   * their own card — which is exactly the thing that must not end up in a
   * message to the room. The host's phone is the same, plus the packs it is
   * dealing from, which the server already keeps to itself.
   */
  useEffect(() => {
    const mine = payload?.private ?? {};
    keepQuiet([mine.word, mine.decoy, payload?.state?.secretWord].filter(Boolean));
    describe({
      wordLang: payload?.state?.config?.wordLang ?? null,
      mode: isHost ? 'room (host)' : 'room (guest)',
      phase: payload?.state?.phase ?? null,
      players: payload?.state?.players?.length ?? null,
    });
    return () => describe({ mode: null, phase: null, players: null, wordLang: null });
  }, [payload, isHost]);

  // The last pack list this phone actually sent up, in full.
  const pushed = useRef(null);

  useEffect(() => {
    if (!isHost || !payload || payload.state.phase !== PHASE.LOBBY) return;

    // What the room is holding, as much of it as the room will say: the
    // words in a custom pack are stripped out of the broadcast on purpose,
    // so this is an id and a count and nothing more. Comparing that against
    // the host's own id and count was the bug — editing a pack keeps its id,
    // and replacing its words keeps its count, so the two agreed while the
    // room went on dealing from the list the host had just rewritten. On the
    // server, where a reload could not fix it.
    const shapeUp = JSON.stringify(payload.state.customPacks.map((p) => [p.id, p.count ?? 0]));
    const shapeHere = JSON.stringify(myPacks.map((p) => [p.id, p.pairs.length]));

    // So the real question is asked of this phone instead, where the words
    // are: has what I hold changed since I last sent it? The shape check
    // stays alongside it, for a room this phone has not sent to yet — a
    // fresh room, a reconnect, or a server that restarted under us.
    const mine = JSON.stringify(myPacks.map((p) => [p.id, p.pairs.map((q) => [q.word, q.decoy])]));
    if (pushed.current === mine && shapeUp === shapeHere) return;

    act({ type: 'SET_CUSTOM_PACKS', packs: myPacks });
    pushed.current = mine;
  }, [isHost, payload, myPacks, act]);

  const savePack = (pack) => {
    setMyPacks((packs) => {
      const next = [...packs.filter((p) => p.id !== pack.id), pack].slice(0, PACK_LIMITS.packs);
      savePacks(next);
      return next;
    });
    setEditing(false);
  };

  const deletePack = (id) => {
    setMyPacks((packs) => {
      const next = packs.filter((p) => p.id !== id);
      savePacks(next);
      return next;
    });
    setEditing(false);
  };

  if (!payload) {
    return (
      <Shell onBack={onExit} code={session.code}>
        <p className="subtitle center dots">
          {connection === 'lost' ? t('room.reconnecting') : t('room.joining')}
        </p>
        <button className="btn-link" onClick={reconnect}>{t('room.retry')}</button>
        <button className="btn-link" onClick={onLeave}>
          {t('room.leave')}
        </button>
      </Shell>
    );
  }

  const { state } = payload;

  const body = (() => {
    if (browsing) {
      return (
        <PackLibrary
          lang={state.config.wordLang}
          customPacks={myPacks}
          // A guest can read the shelf, but only whoever opened the room
          // writes to it: their packs are the ones being dealt from.
          onEdit={
            isHost
              ? (id) => {
                  setBrowsing(false);
                  setEditing(id);
                }
              : null
          }
          onClose={() => setBrowsing(false)}
        />
      );
    }
    if (editing !== false) {
      return (
        <PackEditor
          pack={myPacks.find((p) => p.id === editing) ?? null}
          lang={state.config.wordLang}
          onSave={savePack}
          onDelete={deletePack}
          onClose={() => setEditing(false)}
        />
      );
    }
    // Which screen goes with which phase is shared with the one-phone mode,
    // so a new phase is one edit rather than two. See ../screens.js.
    return renderPhase(state.phase, {
      lobby: () => (
        <OnlineLobby
          payload={payload}
          act={act}
          myPacks={myPacks}
          onEditPack={setEditing}
          onBrowsePacks={() => setBrowsing(true)}
        />
      ),
      reveal: () => <OnlineReveal payload={payload} act={act} />,
      clues: () => <OnlineClues payload={payload} act={act} />,
      vote: () => <OnlineVote payload={payload} act={act} />,
      verdict: () => (
        <VerdictCard
          state={state}
          canContinue={isHost}
          onContinue={() => act({ type: 'CONTINUE' })}
        />
      ),
      // Keyed off who was actually voted out rather than off the role: in
      // blind mode nobody is told their role, so the role would be 'unknown'
      // even for the player who is owed the guess.
      steal: () => (
        <StealCard
          canGuess={state.stealBy === payload.you}
          imposterNames={[state.players.find((p) => p.id === state.stealBy)?.name].filter(Boolean)}
          onGuess={(text) => act({ type: 'STEAL_GUESS', text })}
        />
      ),
      gameOver: () => (
        <GameOverCard
          state={state}
          canRestart={isHost}
          onPlayAgain={() => act({ type: 'PLAY_AGAIN' })}
        />
      ),
    });
  })();

  return (
    // The lobby prints the code in full, so the chip is only useful once play
    // has started and someone asks what the room was.
    <Shell
      onBack={onExit}
      // The lobby prints the code in the middle of the screen, so the topbar
      // leaves it alone — but the library and the pack editor cover that
      // card, and somebody at the door is still asking what the code is.
      code={state.phase === PHASE.LOBBY && !browsing && editing === false ? undefined : payload.code}
      phase={state.phase}
    >
      <Announce>{t(`step.${state.phase === PHASE.CLUES ? 'clues' : 'result'}`)}</Announce>
      {connection === 'lost' && (
        <Banner>
          {t('room.dropped')}{' '}
          <button className="btn-link" onClick={reconnect}>{t('room.retry')}</button>
        </Banner>
      )}
      {error && <Banner kind="error">{errorText(error)}</Banner>}
      {body}
      {state.phase === PHASE.LOBBY && (
        <button className="btn-link" onClick={onLeave}>
          {t('room.leave')}
        </button>
      )}
    </Shell>
  );
}
