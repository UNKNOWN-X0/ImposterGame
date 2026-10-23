/**
 * Questions about a game in progress.
 *
 * Pure reads, no decisions: who is still in, whose turn it is, what one
 * player may see, and what is safe to send to every phone in the room. The
 * screens ask these as well as the rules do, which is why they are their own
 * file rather than private to the reducer.
 */

import { ROLE, winsWithImposters } from './roles/index.js';
import { publicImposterCount } from './rules.js';
import { tally } from './engine.js';
import { PHASE } from './phases.js';
import { guard } from './strict.js';
import { roleSpec } from './roles/index.js';

/* ------------------------------------------------------------------ *
 * Derived helpers — used by the UIs too, so they live here.
 * ------------------------------------------------------------------ */

export const isAlive = (state, id) => !state.eliminated.includes(id);
export const alivePlayers = (state) => state.players.filter((p) => isAlive(state, p.id));
export const isImposter = (state, id) => state.imposterIds.includes(id);

/** What this player actually is. Everyone not dealt something else is crew. */
export const roleOf = (state, id) =>
  isImposter(state, id) ? ROLE.IMPOSTER : state.roles?.[id] ?? ROLE.CREW;

/**
 * Who is playing for the imposters — which is not the same as who has a
 * false word. The sidekick holds the real word and sounds like crew, but
 * wins with the imposters, so they count on that side when the table is
 * being taken over.
 */
export const isImposterSide = (state, id) =>
  isImposter(state, id) || winsWithImposters(roleOf(state, id));
export const playerById = (state, id) => state.players.find((p) => p.id === id) || null;

/** Alive players in speaking order, rotated so a different player opens each round. */
export function speakingOrder(state) {
  const alive = state.order.filter((id) => isAlive(state, id));
  if (alive.length === 0) return [];
  const offset = (state.round - 1) % alive.length;
  return [...alive.slice(offset), ...alive.slice(0, offset)];
}

/** Clues given this round, in the order they were given. */
export function cluesThisRound(state) {
  return state.clues.filter((c) => c.round === state.round);
}

/** Whose turn it is to give a clue, or null when the round is done. */
export function currentTurn(state) {
  if (state.phase !== PHASE.CLUES) return null;
  const given = new Set(cluesThisRound(state).map((c) => c.playerId));
  return speakingOrder(state).find((id) => !given.has(id)) ?? null;
}

/** May this player call the word right now? */
export function canCall(state, playerId) {
  return Boolean(
    state.config.allowCall &&
      state.phase === PHASE.CLUES &&
      isAlive(state, playerId) &&
      isImposter(state, playerId),
  );
}

/** Who still has to vote. */
export function pendingVoters(state) {
  if (state.phase !== PHASE.VOTE) return [];
  return alivePlayers(state)
    .map((p) => p.id)
    .filter((id) => !(id in state.votes));
}

/**
 * What a given player is allowed to see.
 *
 * Never leaks the secret word to an imposter — and in blind mode never leaks
 * the role either, to anyone. The role is reported as 'unknown' rather than
 * omitted so a client cannot infer anything from a missing field.
 */
export function viewFor(state, playerId) {
  const imposter = isImposter(state, playerId);
  const blind = state.config.imposterKnows === false;
  const role = roleOf(state, playerId);
  const nameOf = (id) => playerById(state, id)?.name ?? null;
  return {
    role: blind ? 'unknown' : role,
    // On 'blank' and 'hint' the decoy was never dealt in the first place, so
    // there is nothing here to leak.
    word: imposter ? state.imposterWord : state.secretWord,
    // Only the imposter is ever told anything about the word they do not have.
    hint: imposter ? state.imposterHint : null,
    // Which pack the REAL word came from — the same on every card, including
    // an imposter's. The table plays to a known category and a secret word,
    // so this is not a leak: it is the frame everyone is bluffing inside. It
    // is the real pack even when the decoy was pulled from another one, or a
    // 'way off' card would quietly name the wrong category on every phone.
    packId: state.packId,
    fellowImposters:
      imposter && !blind
        ? state.imposterIds
            .filter((id) => id !== playerId)
            .map((id) => playerById(state, id)?.name)
        : [],
    // The detective's one certainty. Nobody else is told it, and the
    // detective is not told it is the only one they get.
    // A role that was dealt a name is shown it; the rules do not know which
    // role that is, only that it said so.
    cleared: !blind && roleSpec(role)?.reveals === 'cleared' ? nameOf(state.clearedId) : null,
    // The sidekick is told who to protect. They are not told the word the
    // imposter is missing, because they already have the real one.
    knownImposters:
      !blind && roleSpec(role)?.reveals === 'imposters'
        ? state.imposterIds.map((id) => nameOf(id))
        : [],
  };
}

/**
 * State with every secret stripped out, for broadcasting to all clients.
 * The server sends this to everyone and adds each player's private view
 * separately, so a curious player cannot read the word out of the network tab.
 */
/**
 * One scrub per state, however many phones are listening.
 *
 * The server builds a payload for every connected phone on every action, and
 * every one of those called this. With eight phones in a room that was eight
 * identical passes over the same state — the same packs mapped, the same
 * votes counted, the same object rebuilt — to produce eight copies of the
 * same 891 bytes.
 *
 * The key is the state object itself, which is safe precisely because the
 * engine never changes one: a new state is a new object, so a stale entry
 * cannot be reached, and in development the freeze in strict.js makes that a
 * rule the engine cannot break by accident rather than a habit it happens to
 * keep. A WeakMap means a finished game's entry goes when the game does.
 */
const scrubbed = new WeakMap();

export function publicState(state) {
  const already = scrubbed.get(state);
  if (already) return already;
  // Frozen because it is now shared: with one copy going to every phone, a
  // mutation anywhere would be a mutation everywhere. `guard` deepens that
  // to the whole thing in development.
  const fresh = guard(Object.freeze(buildPublicState(state)));
  scrubbed.set(state, fresh);
  return fresh;
}

function buildPublicState(state) {
  const revealAll = state.phase === PHASE.GAME_OVER;
  // `history` holds the word currently in play at the front of its list, so
  // it is stripped rather than nulled — there is no version of it a client
  // should see, and forgetting to null one field is how a secret escapes.
  const { history, ...shared } = state;
  return {
    ...shared,
    // The seed is the whole deal in one number. Every input to it is already
    // public — the roster in order, the config, the pack ids, and the word
    // lists themselves, which ship inside every client's own bundle — so a
    // phone holding the seed can replay `pickWord` and `pickImposters` and
    // read the word and the imposter list straight off its own screen. That
    // is the one secret that cannot be nulled late: it goes out at REVEAL,
    // before anybody has said anything. Nulling it is the point of all the
    // nulls below; without this they only hide the answer, they do not keep
    // it. Nothing outside core/ ever reads it, so nothing loses anything —
    // and the behaviour fingerprint hashes this object, so if it ever comes
    // back the check fails.
    seed: null,
    secretWord: revealAll ? state.secretWord : null,
    imposterWord: revealAll ? state.imposterWord : null,
    imposterHint: revealAll ? state.imposterHint : null,
    imposterIds: revealAll ? state.imposterIds : [],
    // Who was dealt what is every bit as secret as the word. Knowing where
    // the jester is sitting, or that the person next to you is the sidekick,
    // is the game over — so the map goes out empty until it is.
    roles: revealAll ? state.roles : {},
    // A custom pack is a word list, and a word list is a list of candidate
    // answers. Every phone needs to know the pack exists and what it is
    // called, to show it in the settings and name it on a card; none of them
    // needs the words in it. So what goes out is the label and a count.
    customPacks: state.customPacks.map(({ pairs, ...meta }) => ({
      ...meta,
      pairs: [],
      count: pairs.length,
    })),
    clearedId: revealAll ? state.clearedId : null,
    // Votes stay hidden until the tally so nobody can follow the leader —
    // but WHO has voted is public, so the table knows who it is waiting on.
    votes: state.phase === PHASE.VOTE ? {} : state.votes,
    votedIds: Object.keys(state.votes),
    votedSoFar: Object.keys(state.votes).length,
    // How many imposters there are, but only when the table is allowed to
    // know. On 'random' this stays null until the game is over, which is the
    // whole point of that mode: you cannot count who is left.
    imposterCount: revealAll
      ? state.imposterIds.length
      : publicImposterCount(state.config, state.players.length),
  };
}
