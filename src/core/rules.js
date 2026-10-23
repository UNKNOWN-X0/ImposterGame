/**
 * The numbers the rules are made of, and the settings a table can change.
 *
 * Nothing here looks at a game in progress: these are the limits, the modes,
 * the defaults, and the one function that turns whatever a table asked for
 * into something the engine can trust.
 */

import { DEFAULT_WORD_LANG, WORD_LANGUAGES, packsFor } from '../content/words/index.js';
import { isCustomPackId } from '../content/words/custom.js';
import { ROLE, SPECIAL_ROLES, endingFor, roleSpec, winsWithImposters } from './roles/index.js';
import { pointsFor } from './scoring/index.js';

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

/** What the imposter is shown in place of the real word. */
export const DECOY = {
  BLANK: 'blank',         // nothing at all — hardest
  RELATED: 'related',     // a near-miss from the same pair
  UNRELATED: 'unrelated', // a real word, but from a different pack entirely
  HINT: 'hint',           // no word: a description of the real one instead
};

/** The modes whose card would not look like everyone else's. */
const TELLTALE_DECOYS = [DECOY.BLANK, DECOY.HINT];

/** 'auto' scales with the table, 'random' is re-rolled and never shown. */
export const IMPOSTERS_AUTO = 'auto';
export const IMPOSTERS_RANDOM = 'random';

/** Play until somebody wins rather than stopping after a set number of rounds. */
export const ROUNDS_UNLIMITED = 'unlimited';

/**
 * A backstop for unlimited games.
 *
 * Unlimited ends the moment the imposters are caught or reach parity, and
 * both of those follow from eliminating people. A table that ties its vote
 * every single round eliminates nobody and would play forever, so there is a
 * hard ceiling well past any real game. It exists so that "every game
 * terminates" stays a property the tests can check, not because anyone will
 * ever reach it.
 */
export const SAFETY_ROUNDS = 20;

/**
 * The roles a card can carry.
 *
 * Crew and imposter are the game. The other three are optional, each one a
 * twist on a side rather than a side of its own — except the jester, who
 * plays against both and wins by losing.
 *
 * Each one is a file in ./roles, and the engine reads what it says rather
 * than naming it: which side it wins with, anything extra it is dealt, and
 * whether voting it out ends the game. Adding one is a file there.
 */

/**
 * A special role is only dealt while this many plain crew would still be
 * left. A table of five where three people have powers is not a party game,
 * it is a committee.
 */
export const PLAIN_CREW_FLOOR = 2;

export const DEFAULT_CONFIG = {
  wordLang: DEFAULT_WORD_LANG, // which language the secret words come from
  packIds: [],                 // [] means "use every pack"
  imposterCount: IMPOSTERS_AUTO,
  decoyMode: DECOY.RELATED,
  imposterKnows: true, // false = nobody is told their role at all
  allowSteal: true,    // an imposter voted out may still win by naming the word
  allowCall: true,     // an imposter may call the word mid-round
  maxRounds: 4,        // crew runs out of time after this many clue rounds
  roles: [],           // which special roles are in play, if any
  scoring: false,      // keep a running score across the night
};

/**
 * Settles the settings that cannot both be true.
 *
 * Blind mode — where nobody is told their role — rules out two things that
 * otherwise give the game away:
 *
 *   - A blank card, or a card holding a hint rather than a word, would tell
 *     the imposter exactly who they are the moment they look at it. Blind
 *     mode therefore always deals an ordinary-looking decoy word.
 *   - Calling the word mid-round makes no sense when you do not know whether
 *     your own word is the odd one out, and a button that only imposters can
 *     see would give them away. So calling is off.
 *
 * Normalising here rather than at each call site means the lobby shows the
 * settings that will actually be played, instead of promising something the
 * deal then quietly overrides.
 */
export function normaliseConfig(config) {
  const next = { ...DEFAULT_CONFIG, ...config };

  // Settings arrive over the network from whichever phone is hosting, so
  // every value is checked rather than trusted. Anything unrecognised falls
  // back to the default instead of travelling on into the deal: a maxRounds
  // of "lots" compares false against every number, which would silently turn
  // the round limit off and print "Round 1 of lots" on every phone.
  const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  const whole = (value) => (Number.isInteger(value) ? value : null);

  next.wordLang = oneOf(next.wordLang, WORD_LANGUAGES.map((l) => l.id), DEFAULT_CONFIG.wordLang);

  // A pack id is either one of the built-in ones for this language, or a
  // custom one. The custom ones cannot be checked here — this function only
  // sees the config, and the packs themselves live beside it — so they are
  // let through and resolved at the deal, where an id that no longer matches
  // anything simply contributes no words.
  const known = new Set(packsFor(next.wordLang).map((pack) => pack.id));
  next.packIds = Array.isArray(next.packIds)
    ? next.packIds.filter((id) => known.has(id) || isCustomPackId(id))
    : [];

  next.decoyMode = oneOf(next.decoyMode, Object.values(DECOY), DEFAULT_CONFIG.decoyMode);
  next.imposterKnows = flag(next.imposterKnows, DEFAULT_CONFIG.imposterKnows);
  next.allowSteal = flag(next.allowSteal, DEFAULT_CONFIG.allowSteal);
  next.allowCall = flag(next.allowCall, DEFAULT_CONFIG.allowCall);

  if (next.maxRounds !== ROUNDS_UNLIMITED) {
    const rounds = whole(next.maxRounds);
    next.maxRounds = rounds && rounds >= 1 && rounds <= SAFETY_ROUNDS ? rounds : DEFAULT_CONFIG.maxRounds;
  }

  if (next.imposterCount !== IMPOSTERS_AUTO && next.imposterCount !== IMPOSTERS_RANDOM) {
    const count = whole(next.imposterCount);
    // The table size caps it at deal time; this only rejects what is not a
    // count at all.
    next.imposterCount =
      count && count >= 1 && count <= MAX_PLAYERS ? count : DEFAULT_CONFIG.imposterCount;
  }

  next.roles = Array.isArray(next.roles)
    ? SPECIAL_ROLES.filter((role) => next.roles.includes(role))
    : [];
  next.scoring = flag(next.scoring, DEFAULT_CONFIG.scoring);

  if (next.imposterKnows === false) {
    if (TELLTALE_DECOYS.includes(next.decoyMode)) next.decoyMode = DECOY.RELATED;
    next.allowCall = false;
    // Every optional role is a thing you know about yourself, and blind mode
    // is the mode where nobody is told anything. A jester who does not know
    // they are the jester is just an unlucky crew member.
    next.roles = [];
  }
  return next;
}

/**
 * The most imposters a table can take before the game stops being winnable
 * for the crew. The imposters' side must never start at parity.
 *
 * "Side", not "imposters": the sidekick is counted as an imposter by
 * `resolveOutcome`, which ends the game the moment that side is level with
 * the crew. The cap only ever counted the imposters themselves, so turning
 * the sidekick on and setting the count to the number this function offered
 * dealt a game that was already over — one clue round, one vote, and every
 * possible result read `imposters/outnumbered`, including a tie where
 * nobody was voted out at all. That held at every table size from five up.
 *
 * So an ally costs a seat. `roles` is what the table has enabled; passing
 * nothing asks the old question, which is still the right one for a table
 * with no special roles.
 */
export function maxImpostersFor(playerCount, roles = []) {
  const allies = [...new Set(roles ?? [])].filter(winsWithImposters).length;
  return Math.max(1, Math.floor((playerCount - 1) / 2) - allies);
}

/** The count 'auto' picks: roughly one imposter per three or four players. */
export function autoImposterCount(playerCount, roles = []) {
  const scaled = playerCount <= 5 ? 1 : playerCount <= 8 ? 2 : 3;
  return Math.min(maxImpostersFor(playerCount, roles), scaled);
}

/**
 * Turns the setting into an actual number.
 *
 * 'random' draws from the seeded generator so a game is still reproducible,
 * and the resolved number is deliberately never written back into the config —
 * that is what keeps it hidden from the players.
 */
export function resolveImposterCount(setting, playerCount, rng, roles = []) {
  const cap = maxImpostersFor(playerCount, roles);
  if (setting === IMPOSTERS_AUTO) return autoImposterCount(playerCount, roles);
  if (setting === IMPOSTERS_RANDOM) return 1 + Math.floor(rng() * cap);
  const fixed = Number(setting);
  return Math.min(Math.max(1, Number.isFinite(fixed) ? fixed : 1), cap);
}

/**
 * The number of imposters, when the players are allowed to know it.
 * On 'random' this is null and stays null until the game is over.
 */
export function publicImposterCount(config, playerCount) {
  if (config.imposterCount === IMPOSTERS_RANDOM) return null;
  return resolveImposterCount(config.imposterCount, playerCount, () => 0, config.roles);
}
