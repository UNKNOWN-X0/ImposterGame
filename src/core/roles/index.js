/**
 * The optional roles, as a registry rather than as a list of special cases.
 *
 * A role is a small description of how it differs from plain crew: which side
 * it wins with, anything extra it is dealt, and whether voting it out ends
 * the game. The engine reads those fields; it does not know the word
 * "jester". Adding a role is a file here and an entry in ROLES — plus its
 * name and a line of explanation in src/i18n, which is where all the words
 * live.
 *
 * Every role is optional. A table that turns none of them on plays the game
 * these were added to, and nothing in here runs at all.
 */

import detective from './detective.js';
import sidekick from './sidekick.js';
import jester from './jester.js';

/** In the order they are offered in the settings. */
export const ROLES = [detective, sidekick, jester];

export const ROLE = {
  CREW: 'crew',
  IMPOSTER: 'imposter',
  DETECTIVE: detective.id,
  SIDEKICK: sidekick.id,
  JESTER: jester.id,
};

/** The ids a table can switch on, in the order the settings show them. */
export const SPECIAL_ROLES = ROLES.map((role) => role.id);

const BY_ID = new Map(ROLES.map((role) => [role.id, role]));

/** One role by id, or null for plain crew and for anything unrecognised. */
export const roleSpec = (id) => BY_ID.get(id) ?? null;

/** Does this role win with the imposters? */
export const winsWithImposters = (id) => roleSpec(id)?.side === 'imposters';

/** Does voting this role out end the game, and how? */
export const endingFor = (id) => roleSpec(id)?.endsGameWhenVotedOut ?? null;

/**
 * Roles the table asked for, in a fixed order, ignoring anything unknown —
 * a saved game or a room from another version can name a role this build has
 * never heard of, and that is a role fewer rather than a broken game.
 */
export const enabledRoles = (ids = []) => ROLES.filter((role) => ids.includes(role.id));
