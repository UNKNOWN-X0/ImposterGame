/**
 * Rule violations travel as codes, not sentences.
 *
 * The engine has no idea what language anyone is reading, and in a room two
 * players may be reading different ones. Every refusal is a code and, where
 * it helps, the numbers to put in the sentence; the interface turns that into
 * words. See `useErrorText` in src/i18n.
 */

export class GameError extends Error {
  constructor(code, params) {
    super(code);
    this.name = 'GameError';
    this.code = code;
    this.params = params;
  }
}

/** Refuse an action, in the only vocabulary the rules have. */
export const fail = (code, params) => {
  throw new GameError(code, params);
};
