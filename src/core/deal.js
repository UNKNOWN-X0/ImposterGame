/**
 * Starting a game: the word, the imposters, the roles.
 *
 * Everything here is fed the seeded random source, so the same seed always
 * deals the same game. It also carries the fairness the table would otherwise
 * have to keep track of — nobody imposter twice running, no word twice in an
 * evening.
 */

import { enabledRoles } from './roles/index.js';
import { DECOY, PLAIN_CREW_FLOOR, normaliseConfig } from './rules.js';
import { normalise } from './engine.js';
import { PHASE } from './phases.js';
import { DEFAULT_CONFIG } from './rules.js';
import { guard } from './strict.js';

/* ------------------------------------------------------------------ *
 * Creating a game
 * ------------------------------------------------------------------ */

export const EMPTY_HISTORY = { words: [], lastImposters: [], imposterCounts: {} };

/**
 * `history` carries what was dealt in previous games so the next deal can
 * avoid repeating it. It survives PLAY_AGAIN and RESET — the same people are
 * still at the same table — and is never sent to clients, because it holds
 * the word currently in play.
 */
export function createGame(config = {}, history = EMPTY_HISTORY, scores = {}) {
  // Frozen in development like everything else the engine hands out, so a
  // fresh game is held to the same promise as one that has been played.
  return guard({
    phase: PHASE.LOBBY,
    config: normaliseConfig({ ...DEFAULT_CONFIG, ...config }),
    history,
    seed: null,
    players: [],
    imposterIds: [],
    roles: {},        // playerId -> one of the optional roles; crew if absent
    clearedId: null,  // the player the detective is told is not an imposter
    secretWord: null,
    imposterWord: null,
    imposterHint: null, // hint mode: a description of the word, not a word
    packId: null,
    order: [],
    revealed: [],
    round: 1,
    clues: [],
    votes: {},
    eliminated: [],
    lastVote: null,
    stealGuess: null,
    stealBy: null, // the imposter currently owed a final guess
    call: null,    // a mid-round call: { playerId, text, correct }
    result: null,
    gamesPlayed: 0,
    // Points for the night, kept across games and cleared by hand. Empty
    // unless scoring is switched on.
    scores: scores ?? {},
    lastWinners: [],  // who scored in the game just finished
    lastAward: 0,     // and what that way of winning was worth
    // Packs the table wrote themselves. They live in the game rather than in
    // the config because the config is public and these are word lists.
    customPacks: [],
  });
}

let idCounter = 0;
export function makePlayerId() {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter}`;
}

/**
 * How many recent words to remember.
 *
 * Half the pool, capped, so a small single-pack selection still cycles rather
 * than locking most of itself out, while a thousand-word pool does not carry
 * an ever-growing list for no benefit.
 */
const HISTORY_CAP = 40;

export function recentWordWindow(poolSize) {
  return Math.max(1, Math.min(Math.floor(poolSize / 2), HISTORY_CAP));
}

/**
 * Picks a word the table has not had recently.
 *
 * Plain uniform random repeats more than people expect: inside one selected
 * pack of a hundred, the same word comes back every few nights, and a
 * back-to-back repeat makes the game feel broken even though nothing is wrong.
 * Remembering the recent ones costs nothing and removes the complaint.
 *
 * If every word in the pool is in the history — a tiny custom selection — it
 * falls back to the whole pool rather than dealing nothing.
 */
export function pickWord(pool, rng, recentWords = []) {
  const recent = new Set(recentWords.map(normalise));
  const fresh = pool.filter((p) => !recent.has(normalise(p.word)));
  const source = fresh.length ? fresh : pool;
  return source[Math.floor(rng() * source.length)];
}

/**
 * Picks who the imposters are, spreading the role around.
 *
 * Two things are wrong with drawing uniformly every game. With five players
 * the same person is the imposter twice running one night in five, which
 * reads as a bug; and over an evening somebody usually never gets a turn at
 * the good part of the game.
 *
 * So: nobody who was an imposter last game is eligible, and among the rest a
 * player who has been imposter less often is weighted higher. The weighting
 * is deliberately soft rather than a strict "whoever is furthest behind" —
 * that would be predictable, and in a hidden-role game a player who can
 * deduce their own role from the selection rule has been handed the answer.
 *
 * The one thing it does leak is by design and was asked for: last round's
 * imposter knows they are not it this round.
 */
export function pickImposters(ids, count, rng, history) {
  const justWas = new Set(history.lastImposters ?? []);
  let candidates = ids.filter((id) => !justWas.has(id));
  // Cannot happen at the sizes this game allows, since imposters never start
  // at parity, but a table of three must still be dealable.
  if (candidates.length < count) candidates = [...ids];

  const counts = history.imposterCounts ?? {};
  const weightOf = (id) => 1 / (1 + (counts[id] || 0));

  const chosen = [];
  while (chosen.length < count && candidates.length > 0) {
    const total = candidates.reduce((sum, id) => sum + weightOf(id), 0);
    let ticket = rng() * total;
    let i = 0;
    for (; i < candidates.length - 1; i++) {
      ticket -= weightOf(candidates[i]);
      if (ticket <= 0) break;
    }
    chosen.push(candidates.splice(i, 1)[0]);
  }
  return chosen;
}

/**
 * Hands out the optional roles.
 *
 * Only to players who are not imposters, one each, and only while enough
 * plain crew would be left to still have a game. A table that is too small
 * for a role simply does not get it — quietly, because announcing "no jester
 * tonight" would tell everyone something about the deal.
 */
export function dealRoles(enabled, candidates, rng, imposterCount = 0) {
  const pool = [...candidates];
  const roles = {};
  // Where the two sides stand as each role is handed out. An ally moves a
  // seat across the table, so this changes underneath the loop.
  let side = imposterCount;
  let crew = candidates.length;
  for (const role of enabledRoles(enabled)) {
    if (pool.length - 1 < PLAIN_CREW_FLOOR) break;
    const ally = role.side === 'imposters';
    // The cap in `maxImpostersFor` already leaves room for the allies a
    // table has enabled, but it cannot go below one imposter — so at four
    // players one imposter plus a sidekick is still two against two, which
    // `resolveOutcome` reads as the crew already outnumbered. A game that is
    // over before the first clue is not a game. The role is a bonus, not a
    // promise: when there is no room for it, it is simply not dealt.
    if (ally && side + 1 >= crew - 1) continue;
    const index = Math.floor(rng() * pool.length);
    roles[pool.splice(index, 1)[0]] = role.id;
    if (ally) {
      side += 1;
      crew -= 1;
    }
  }
  return roles;
}

/** The history the next game will be dealt against. */
export function nextHistory(previous, pick, imposterIds, poolSize) {
  const imposterCounts = { ...(previous.imposterCounts ?? {}) };
  for (const id of imposterIds) imposterCounts[id] = (imposterCounts[id] || 0) + 1;
  return {
    words: [pick.word, ...(previous.words ?? [])].slice(0, recentWordWindow(poolSize)),
    lastImposters: imposterIds,
    imposterCounts,
  };
}

/**
 * Describes the real word without naming it, for hint mode.
 *
 * The category line comes from the pack, so it is written in the language the
 * words are in. The shape — how many words, how many characters — is counted
 * here and phrased by whichever interface language the reader is using.
 *
 * Characters are counted as everything that is not a space, rather than as
 * "letters". Thai writes its vowels and tone marks as separate code points,
 * so a letters-only count would report a number no Thai player would
 * recognise as the length of the word in front of them.
 */
export function hintFor(pick) {
  const words = pick.word.trim().split(/\s+/).filter(Boolean);
  return {
    text: pick.hint || null,
    words: words.length,
    chars: [...pick.word].filter((c) => !/\s/.test(c)).length,
  };
}

/**
 * Picks what the imposter is shown.
 *
 * - blank:     nothing, so there is no decoy to deal at all
 * - related:   the pair's near-miss, close enough to bluff with
 * - unrelated: a real word from a *different* pack, which is much harder —
 *              the imposter has a word, but it points nowhere near the truth
 *
 * With only one pack selected there is no other pack to draw from, so an
 * unrelated decoy falls back to any other word in that pack.
 */
export function decoyFor(mode, pick, pool, rng) {
  if (mode === DECOY.BLANK || mode === DECOY.HINT) return null;

  if (mode !== DECOY.UNRELATED) {
    if (pick.decoy) return pick.decoy;
    // A pack somebody wrote may be a plain list of words with no near miss
    // against them. Another word from the same pack is the closest thing to
    // one: same subject, same handwriting, and still not the answer.
    const siblings = pool.filter((p) => p.packId === pick.packId && p.word !== pick.word);
    const source = siblings.length ? siblings : pool.filter((p) => p.word !== pick.word);
    if (source.length === 0) return null;
    return source[Math.floor(rng() * source.length)].word;
  }

  const elsewhere = pool.filter((p) => p.packId !== pick.packId);
  const source = elsewhere.length ? elsewhere : pool.filter((p) => p.word !== pick.word);
  if (source.length === 0) return pick.decoy;
  return source[Math.floor(rng() * source.length)].word;
}
