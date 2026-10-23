/**
 * The rules engine.
 *
 * Pure and deterministic: `reduce(state, action)` returns a NEW state and
 * never touches the DOM, the network, or the clock. The same seed always
 * produces the same word, the same imposters and the same speaking order.
 *
 * Both play modes drive this same engine:
 *   - pass-and-play runs it in the browser
 *   - LAN play runs it on the server and streams the state to every phone
 *
 * That is deliberate: the rules exist in exactly one place, so a fix to the
 * voting logic fixes it for both modes at once.
 *
 * This file holds the reducer and how a round ends. The rest of the rules sit
 * beside it — ./rules.js for the settings and limits, ./select.js for
 * questions about a game, ./deal.js for starting one, ./roles for the
 * optional roles and ./scoring for what each win pays — and everything is
 * re-exported from here, so nothing outside src/core has to know that.
 */

import { poolFor } from '../content/words/index.js';
import { PACK_LIMITS, validatePack } from '../content/words/custom.js';
import { ROLE, endingFor, roleSpec, winsWithImposters } from './roles/index.js';
import { paysTheEliminated, pointsFor } from './scoring/index.js';
import { mulberry32, randomSeed, shuffle } from './rng.js';
import { DECOY, MAX_PLAYERS, MIN_PLAYERS, ROUNDS_UNLIMITED, SAFETY_ROUNDS, normaliseConfig, resolveImposterCount } from './rules.js';
import { alivePlayers, currentTurn, isAlive, isImposter, isImposterSide, pendingVoters, playerById, roleOf } from './select.js';
import { createGame, dealRoles, decoyFor, hintFor, makePlayerId, nextHistory, pickImposters, pickWord } from './deal.js';
import { fail } from './errors.js';
import { PHASE } from './phases.js';
import { guard } from './strict.js';

/* ------------------------------------------------------------------ *
 * The reducer
 * ------------------------------------------------------------------ */

/**
 * The rules, as one function: a state and an action in, a new state out.
 *
 * The wrapper is strict mode (./strict.js). In development every state that
 * leaves here is frozen, so code that changes one in place throws on the line
 * that did it instead of quietly handing React a state it believes has not
 * changed. In production it is handed straight back.
 */
export function reduce(state, action) {
  return guard(step(state, action));
}

function step(state, action) {
  switch (action.type) {
    case 'ADD_PLAYER': {
      if (state.phase !== PHASE.LOBBY) fail('alreadyStarted');
      const name = String(action.name || '').trim();
      if (!name) fail('emptyName');
      if (name.length > 16) fail('longName');
      if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
        fail('duplicateName', { name });
      if (state.players.length >= MAX_PLAYERS) fail('roomFull', { max: MAX_PLAYERS });
      const player = { id: action.id || makePlayerId(), name };
      return { ...state, players: [...state.players, player] };
    }

    case 'REMOVE_PLAYER': {
      if (state.phase !== PHASE.LOBBY) fail('midGameLeave');
      // Everything keyed by this player goes with them. Found by the fuzzer:
      // taking somebody out of the lobby left their points behind, and since
      // ids are minted per player, adding the same person back gives them a
      // new one — so the old entry could never be reached again, only
      // broadcast to every phone and carried around for the rest of the
      // evening. The fairness counts go for the same reason.
      const gone = action.playerId;
      const { [gone]: _points, ...scores } = state.scores;
      const { [gone]: _wasImposter, ...imposterCounts } = state.history.imposterCounts;
      return {
        ...state,
        players: state.players.filter((p) => p.id !== gone),
        scores,
        lastWinners: state.lastWinners.filter((id) => id !== gone),
        history: {
          ...state.history,
          lastImposters: state.history.lastImposters.filter((id) => id !== gone),
          imposterCounts,
        },
      };
    }

    case 'SET_CONFIG': {
      if (state.phase !== PHASE.LOBBY) fail('notLobby');
      const config = { ...state.config, ...action.config };
      // Pack ids belong to one language's packs, so switching the word
      // language starts again from "everything" rather than leaving a
      // selection that no longer matches anything.
      if (action.config.wordLang && action.config.wordLang !== state.config.wordLang) {
        config.packIds = [];
      }
      return { ...state, config: normaliseConfig(config) };
    }

    case 'START_GAME': {
      if (state.phase !== PHASE.LOBBY) fail('alreadyStarted');
      if (state.players.length < MIN_PLAYERS) fail('needPlayers', { min: MIN_PLAYERS });

      const seed = action.seed ?? randomSeed();
      const rng = mulberry32(seed);

      const pool = poolFor(state.config.wordLang, state.config.packIds, state.customPacks);
      if (pool.length === 0) fail('noPacks');
      const pick = pickWord(pool, rng, state.history.words);

      const config = normaliseConfig(state.config);
      const imposterCount = resolveImposterCount(
        config.imposterCount,
        state.players.length,
        rng,
        // The cap depends on the roles: anything that wins with the imposters
        // is a seat on their side of the table.
        config.roles,
      );

      const ids = state.players.map((p) => p.id);
      const imposterIds = pickImposters(ids, imposterCount, rng, state.history);

      // The optional roles come out of whoever is left.
      const others = ids.filter((id) => !imposterIds.includes(id));
      const roles = dealRoles(config.roles, others, rng, imposterIds.length);

      // Some roles are dealt something beyond a word — the detective is
      // handed a name — so each one that was dealt gets asked. What it hands
      // back is merged into the game, which is how a role can add to the
      // state without the rules knowing what it added.
      //
      // The pool it draws from is the plain crew: anything a role is told has
      // to be worth knowing, and "this sidekick is not an imposter" is true
      // and useless.
      const plainCrew = others.filter((id) => !roles[id]);
      const dealt = {};
      for (const [playerId, roleId] of Object.entries(roles)) {
        const spec = roleSpec(roleId);
        if (spec?.deal) Object.assign(dealt, spec.deal({ playerId, plainCrew, others, rng }));
      }

      return {
        ...state,
        phase: PHASE.REVEAL,
        seed,
        // Note the config is NOT rewritten with the resolved count: on
        // 'random' that number is the secret, and the config is public.
        config,
        secretWord: pick.word,
        imposterWord: decoyFor(config.decoyMode, pick, pool, rng),
        imposterHint: config.decoyMode === DECOY.HINT ? hintFor(pick) : null,
        packId: pick.packId,
        imposterIds,
        roles,
        clearedId: null,
        ...dealt,
        order: shuffle(ids, rng),
        revealed: [],
        round: 1,
        clues: [],
        votes: {},
        eliminated: [],
        lastVote: null,
        stealGuess: null,
        stealBy: null,
        call: null,
        result: null,
        history: nextHistory(state.history, pick, imposterIds, pool.length),
      };
    }

    case 'MARK_REVEALED': {
      if (state.phase !== PHASE.REVEAL) fail('notReveal');
      if (!playerById(state, action.playerId)) fail('unknownPlayer');
      const revealed = state.revealed.includes(action.playerId)
        ? state.revealed
        : [...state.revealed, action.playerId];
      const everyone = revealed.length === state.players.length;
      return { ...state, revealed, phase: everyone ? PHASE.CLUES : PHASE.REVEAL };
    }

    case 'SUBMIT_CLUE': {
      if (state.phase !== PHASE.CLUES) fail('notClues');
      const turn = currentTurn(state);
      if (action.playerId !== turn) fail('notYourTurn');
      const text = String(action.text || '').trim();
      if (!text) fail('emptyClue');
      if (text.length > 24) fail('longClue');
      if (/\s/.test(text)) fail('oneWord');
      if (state.secretWord && sameWord(text, state.secretWord)) fail('clueIsWord');
      // Repeating someone else's clue is against the rules of the game, so the
      // game enforces it rather than leaving it to whoever is loudest.
      if (state.clues.some((c) => sameClue(c.text, text))) fail('clueTaken');

      const clues = [...state.clues, { round: state.round, playerId: action.playerId, text }];
      const next = { ...state, clues };
      // Round is over once everyone still alive has spoken.
      const done = currentTurn(next) === null;
      return done ? { ...next, phase: PHASE.VOTE, votes: {} } : next;
    }

    case 'FORCE_VOTE': {
      if (state.phase !== PHASE.CLUES) fail('notClues');
      return { ...state, phase: PHASE.VOTE, votes: {} };
    }

    case 'CAST_VOTE': {
      if (state.phase !== PHASE.VOTE) fail('notVote');
      const { voterId, targetId } = action;
      if (!isAlive(state, voterId)) fail('deadVoter');
      if (!isAlive(state, targetId)) fail('deadTarget');
      if (voterId === targetId) fail('selfVote');
      const votes = { ...state.votes, [voterId]: targetId };
      const next = { ...state, votes };
      return pendingVoters(next).length === 0 ? resolveVote(next) : next;
    }

    case 'DECLARE_ELIMINATION': {
      // Pass-and-play shortcut: the group votes by show of hands and whoever
      // holds the phone taps the result, instead of passing it around again.
      if (state.phase !== PHASE.VOTE) fail('notVote');
      const id = action.playerId ?? null;
      if (id !== null && !isAlive(state, id)) fail('deadTarget');
      const lastVote = {
        counts: {},
        votes: {},
        declared: true,
        tied: id === null,
        eliminatedId: id,
        wasImposter: id !== null && isImposter(state, id),
        role: id === null ? null : roleOf(state, id),
      };
      return {
        ...state,
        phase: PHASE.VERDICT,
        eliminated: id === null ? state.eliminated : [...state.eliminated, id],
        lastVote,
      };
    }

    case 'CALL_WORD': {
      /**
       * An imposter who is sure declares it out loud and names the word.
       *
       * Right, and the imposters take it there and then — which is the only
       * way for an imposter to win without surviving to the end. Wrong, and
       * that imposter is out and the round carries on: their partner, if
       * they have one, is not punished for someone else's nerve.
       */
      if (!state.config.allowCall) fail('callsOff');
      if (state.phase !== PHASE.CLUES) fail('notClues');
      const { playerId } = action;
      if (!isAlive(state, playerId)) fail('deadVoter');
      if (!isImposter(state, playerId)) fail('notImposter');

      const text = String(action.text || '').trim();
      if (!text) fail('emptyGuess');
      const correct = sameWord(text, state.secretWord);
      const call = { playerId, text, correct };

      if (correct) {
        return finish({ ...state, call }, { winner: 'imposters', reason: 'called' });
      }

      return {
        ...state,
        call,
        phase: PHASE.VERDICT,
        eliminated: [...state.eliminated, playerId],
        lastVote: {
          counts: {},
          votes: {},
          declared: true,
          called: true, // they have already had their guess — no final one
          tied: false,
          eliminatedId: playerId,
          wasImposter: true,
          role: roleOf(state, playerId),
        },
      };
    }

    case 'STEAL_GUESS': {
      if (state.phase !== PHASE.STEAL) fail('notSteal');
      if (action.playerId && action.playerId !== state.stealBy) fail('notImposter');
      const guess = String(action.text || '').trim();
      // CALL_WORD has always guarded this; this one did not, and the button
      // being disabled on empty text is not a rule — the endpoint is open.
      if (!guess) fail('emptyGuess');
      const correct = sameWord(guess, state.secretWord);

      const next = { ...state, stealGuess: { text: guess, correct }, stealBy: null };
      if (correct) {
        return finish(next, { winner: 'imposters', reason: 'steal' });
      }
      // A wrong guess costs nothing extra — they were out either way, so the
      // round simply carries on from where it was.
      return resolveOutcome(next);
    }

    case 'CONTINUE': {
      // Acknowledge a verdict card and move on to whatever comes next.
      if (state.phase !== PHASE.VERDICT) fail('nothingToContinue');
      return advanceAfterVerdict(state);
    }

    case 'PLAY_AGAIN': {
      // Same players, fresh word and fresh roles — but the history comes
      // with them, so the next deal can avoid what they just had.
      const base = createGame(state.config, state.history, state.scores);
      return {
        ...base,
        customPacks: state.customPacks,
        players: state.players,
        gamesPlayed: state.gamesPlayed + 1,
      };
    }

    case 'SET_CUSTOM_PACKS': {
      // Sent by whoever is hosting, from their own phone. Every pack is put
      // through the same cleaning a pack from a stranger's code gets: this
      // arrives over the network like anything else.
      if (state.phase !== PHASE.LOBBY) fail('notLobby');
      const incoming = Array.isArray(action.packs) ? action.packs : [];
      const customPacks = incoming
        .slice(0, PACK_LIMITS.packs)
        .map((pack) => validatePack(pack, state.config.wordLang))
        .filter(Boolean);
      return { ...state, customPacks };
    }

    case 'CLEAR_SCORES':
      // A new night, same people. Deliberately allowed at any time: a table
      // that wants to start the scoring over mid-evening should not have to
      // finish a game first.
      return { ...state, scores: {} };

    case 'RESET':
      // Still the same table, so both the people and what has already been
      // dealt come with it. Clearing the roster here would mean retyping
      // everyone after every game, and — because ids are minted per player —
      // it would also throw away the fairness history that stops the same
      // person being the imposter twice running. Only REMOVE_PLAYER takes
      // someone out of the lobby.
      return {
        ...createGame(state.config, state.history, state.scores),
        customPacks: state.customPacks,
        players: state.players,
      };

    default:
      fail('unknown', { action: action.type });
      return state;
  }
}

/**
 * Loose comparison for words the player typed.
 *
 * Keeps letters, digits AND combining marks of any script, dropping only
 * spacing and punctuation, so those never decide a game.
 *
 * The marks matter. Thai writes its vowels and tone marks as separate code
 * points in category Mn, which `\p{L}` does not cover — leaving them out
 * made ข้าวกล้อง (brown rice) and ข้าวกล่อง (a lunchbox) the same string, and
 * ถังขยะ (a bin) the same as ถุงขยะ (a bin bag). That let a wrong final guess
 * win and made the no-repeated-clues rule reject perfectly good clues.
 *
 * So accents come off Latin letters and nothing else. That is enough for
 * every language here: a German typing "Spatzle" for Spätzle, or anybody
 * typing "Cafe" or "Pokemon" on a keyboard without the accent, is agreeing
 * with the card — and before this, the game told them they were wrong, which
 * in a round where calling the word can lose it is not a small thing. Three
 * shipped words were affected (Crêpe, Café, Pokémon); the German ones were
 * already covered by hand.
 *
 * ß is still folded by hand, because it has no decomposition to strip.
 */
export const normalise = (s) =>
  String(s || '')
    .normalize('NFD')
    // Only where the letter underneath is Latin: a Thai vowel is a combining
    // mark too, and taking those off is the bug described above.
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');

/**
 * Are these the same word?
 *
 * Not `normalise(a) === normalise(b)`, which was the bug. `normalise` keeps
 * only letters, digits and marks, so anything made of punctuation or emoji —
 * `???`, `!!!`, `🎉` — comes back as the empty string, and two empty strings
 * compared equal. A custom pack is allowed any word a person can type, so a
 * table could deal `,,,` as the secret, and then an empty guess "matched" it
 * and won the game.
 *
 * Nothing is not a word, and nothing never matches anything.
 */
export const sameWord = (a, b) => {
  const left = normalise(a);
  return left !== '' && left === normalise(b);
};

/**
 * Are these the same clue?
 *
 * The same question with a different answer in the letterless case. 🎉 and 🔥
 * both normalise to nothing, but they are not the same clue — and the game
 * used to tell the second player someone had already said theirs. 🎉 and 🎉
 * plainly are the same clue, though, so where there is nothing to normalise
 * the comparison falls back to what was actually typed.
 */
const sameClue = (a, b) => {
  const left = normalise(a);
  if (left === '' || normalise(b) === '') return String(a).trim() === String(b).trim();
  return left === normalise(b);
};

/* ------------------------------------------------------------------ *
 * Vote resolution and win conditions
 * ------------------------------------------------------------------ */

export function tally(votes) {
  const counts = {};
  for (const target of Object.values(votes)) counts[target] = (counts[target] || 0) + 1;
  return counts;
}

function resolveVote(state) {
  const counts = tally(state.votes);
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((id) => counts[id] === top);
  const tied = leaders.length !== 1;

  if (tied) {
    return {
      ...state,
      phase: PHASE.VERDICT,
      lastVote: { counts, votes: state.votes, tied: true, eliminatedId: null, wasImposter: false },
    };
  }

  const eliminatedId = leaders[0];
  return {
    ...state,
    phase: PHASE.VERDICT,
    eliminated: [...state.eliminated, eliminatedId],
    lastVote: {
      counts,
      votes: state.votes,
      tied: false,
      eliminatedId,
      wasImposter: isImposter(state, eliminatedId),
      role: roleOf(state, eliminatedId),
    },
  };
}

/**
 * After the verdict card.
 *
 * Any imposter who has just been voted out gets their one final guess —
 * not only the last one standing. Getting it right wins the whole game for
 * the imposters even if their partner is still in play, which is what makes
 * voting out the right person still feel dangerous.
 *
 * The exception is an imposter who called the word mid-round and got it
 * wrong: they have already had their guess.
 */
function advanceAfterVerdict(state) {
  const v = state.lastVote;

  // Some roles win by being voted out — the jester is the one we ship — and
  // that ends it there, which is the whole point of them: the crew has to be
  // right, not merely decisive.
  const ending = v?.eliminatedId ? endingFor(roleOf(state, v.eliminatedId)) : null;
  if (ending) return finish(state, ending);

  const owedAGuess = v?.wasImposter && !v.called && state.config.allowSteal;
  if (owedAGuess) return { ...state, phase: PHASE.STEAL, stealBy: v.eliminatedId };
  return resolveOutcome(state);
}

/**
 * Ends the game, and pays out if anyone is keeping score.
 *
 * A point per win, per player: every crew member still in when the imposters
 * are caught, every imposter when they take it (whether or not they survived
 * — they won), and the jester alone when the jester wins. Scoring is off
 * unless the table asked for it, in which case this is a no-op and the
 * scoreboard simply never appears.
 */
function finish(state, result) {
  const ended = { ...state, phase: PHASE.GAME_OVER, result };
  if (!state.config.scoring) return ended;

  const alive = new Set(alivePlayers(state).map((p) => p.id));
  const stillIn = paysTheEliminated(result.reason) ? () => true : (id) => alive.has(id);
  const winners = state.players
    .map((p) => p.id)
    .filter((id) => {
      const role = roleOf(ended, id);
      const spec = roleSpec(role);
      // A role that wins on its own wins on its own: nobody else is paid for
      // the jester's evening.
      if (spec?.endsGameWhenVotedOut) return result.winner === spec.endsGameWhenVotedOut.winner;
      if (result.winner === 'imposters') return isImposterSide(ended, id);
      if (result.winner === 'crew') return !isImposterSide(ended, id) && stillIn(id);
      return false;
    });

  const award = pointsFor(result.reason);
  const scores = { ...state.scores };
  for (const id of winners) scores[id] = (scores[id] || 0) + award;
  return { ...ended, scores, lastWinners: winners, lastAward: award };
}

/** Who has won, or another round. */
function resolveOutcome(state) {
  const aliveIds = alivePlayers(state).map((p) => p.id);
  // Catching every imposter wins it, even if their sidekick is still sitting
  // there: a sidekick without an imposter has nobody to win with.
  const aliveImposters = aliveIds.filter((id) => isImposter(state, id));
  // Taking the table over is the other side of it, and there the sidekick
  // counts — they are a vote and a voice playing for the imposters.
  const aliveImposterSide = aliveIds.filter((id) => isImposterSide(state, id));
  const aliveRest = aliveIds.filter((id) => !isImposterSide(state, id));

  if (aliveImposters.length === 0) {
    // Did it cost them anybody? Losing a sidekick along the way does not
    // count against the crew — the sidekick was never theirs.
    const lostOwn = state.eliminated.some((id) => !isImposterSide(state, id));
    return finish(state, { winner: 'crew', reason: lostOwn ? 'caught' : 'cleanSweep' });
  }

  if (aliveImposterSide.length >= aliveRest.length) {
    return finish(state, { winner: 'imposters', reason: 'outnumbered' });
  }

  const unlimited = state.config.maxRounds === ROUNDS_UNLIMITED;
  const ceiling = unlimited ? SAFETY_ROUNDS : state.config.maxRounds;
  if (state.round >= ceiling) {
    return finish(state, { winner: 'imposters', reason: 'time' });
  }

  // Another round: everyone still in gives one more clue, on top of the ones
  // they have already given.
  return { ...state, phase: PHASE.CLUES, round: state.round + 1, votes: {} };
}

/* ------------------------------------------------------------------ *
 * Convenience wrapper so callers can do `game.dispatch(...)`
 * ------------------------------------------------------------------ */

export function applyAll(state, actions) {
  return actions.reduce((s, a) => reduce(s, a), state);
}

/* ------------------------------------------------------------------ *
 * The rest of the rules, through this one door
 * ------------------------------------------------------------------ */

export * from './errors.js';
export * from './phases.js';
export * from './rng.js';
export * from './rules.js';
export * from './select.js';
export * from './deal.js';
export { ROLE, SPECIAL_ROLES, ROLES, roleSpec, endingFor, winsWithImposters } from './roles/index.js';
export { WIN_POINTS, WIN_REASONS, MAX_WIN_POINTS, pointsFor } from './scoring/index.js';
