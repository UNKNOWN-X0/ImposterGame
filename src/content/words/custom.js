/**
 * Packs people write themselves.
 *
 * A table's best words are the ones nobody else could have written: the road
 * they live on, the bar they argue about, the seven things their friend says
 * too often. This is how those get in — a pasted list, one entry per line —
 * and how a pack travels to somebody else's phone, as a code you can send in
 * a message.
 *
 * Nothing here touches storage, React or the network. It parses text,
 * validates, and turns a pack into a string and back, which is exactly the
 * kind of thing that should be testable without a browser.
 */

/** Limits, so a pasted novel cannot fill somebody's phone or a room's memory. */
export const PACK_LIMITS = {
  packs: 20, // custom packs kept on one device
  pairs: 400, // entries in one pack
  minPairs: 5, // fewer than this is not a pack, it is a mood
  word: 40, // characters in a word or its near miss
  name: 28, // characters in a pack's name
};

const CUSTOM_PREFIX = 'custom:';

/**
 * What shape a saved pack is in.
 *
 * Packs live in localStorage and in share codes, and both outlive the version
 * of the app that wrote them: somebody writes a pack tonight and opens the
 * game again in six months, on a build that has moved on. Without a number on
 * them there is no way to change the shape later without either breaking what
 * people wrote or guessing — and guessing is how a table loses a pack it
 * spent an evening on.
 *
 * Bump this when the shape changes, and add a step to `migratePack`.
 *
 *   1 — { id, name, emoji, lang, hint, custom, pairs: [{ word, decoy }] }
 */
export const PACK_VERSION = 1;

/** The share-code format, versioned in the prefix for the same reason. */
const CODE_PREFIX = 'IMP1.';
export const CODE_VERSION = 1;

export const isCustomPackId = (id) => String(id ?? '').startsWith(CUSTOM_PREFIX);

/** A short, stable-enough id. Collisions only matter on one device. */
function makePackId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `${CUSTOM_PREFIX}${Date.now().toString(36)}${random}`;
}

const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Reads a pasted list into pairs.
 *
 * One entry per line. A near miss is optional and can be separated by a
 * comma, a semicolon, a pipe, a tab or an en dash, because people paste from
 * notes apps and spreadsheets and each one has its own idea of a separator:
 *
 *     Sushi, Sashimi
 *     Pad thai | Pad see ew
 *     Khao soi
 *
 * Blank lines and anything after a # are ignored, so a list can carry
 * headings and notes. A line that says the same thing twice — "Sushi, Sushi"
 * — keeps the word and drops the near miss rather than dealing a pair that
 * gives the game away.
 *
 * Returns the pairs it understood and a line-by-line account of what it
 * skipped, so the editor can show somebody exactly which line was wrong
 * instead of refusing the whole paste.
 */
export function parsePairs(text) {
  const pairs = [];
  const skipped = [];
  const seen = new Set();

  String(text ?? '')
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      // Split the raw line, then tidy the parts. Tidying first would turn a
      // tab into a space, and a tab is how a spreadsheet says "next column".
      const raw = rawLine.split('#')[0];
      if (!clean(raw)) return;

      const [wordPart, ...rest] = raw.split(/\s*[,;|\t]\s*|\s+[–—]\s+/);
      const line = clean(raw);
      const word = clean(wordPart);
      const decoy = clean(rest.join(' '));
      const at = index + 1;

      if (!word) return;
      if (word.length > PACK_LIMITS.word) {
        skipped.push({ at, line, why: 'tooLong' });
        return;
      }
      if (seen.has(word.toLowerCase())) {
        skipped.push({ at, line, why: 'duplicate' });
        return;
      }
      if (pairs.length >= PACK_LIMITS.pairs) {
        skipped.push({ at, line, why: 'tooMany' });
        return;
      }

      seen.add(word.toLowerCase());
      pairs.push({
        word,
        // A near miss equal to the word is not a near miss, and one that is
        // too long is somebody's sentence.
        decoy:
          decoy && decoy.toLowerCase() !== word.toLowerCase() && decoy.length <= PACK_LIMITS.word
            ? decoy
            : null,
      });
    });

  return { pairs, skipped };
}

/** Turns pairs back into the text somebody pasted, for editing a pack again. */
export function toText(pairs = []) {
  return pairs.map((p) => (p.decoy ? `${p.word}, ${p.decoy}` : p.word)).join('\n');
}

/**
 * Builds a pack, or explains why it cannot.
 *
 * `lang` is the word language it belongs to: a pack of Thai words has no
 * business appearing when the table is playing in German.
 */
export function buildPack({ id, name, emoji, lang, text, pairs }) {
  const parsed = pairs ? { pairs, skipped: [] } : parsePairs(text);
  const cleanName = clean(name).slice(0, PACK_LIMITS.name);

  if (!cleanName) return { error: 'packNeedsName', skipped: parsed.skipped };
  if (parsed.pairs.length < PACK_LIMITS.minPairs) {
    return {
      error: 'packTooSmall',
      params: { min: PACK_LIMITS.minPairs, count: parsed.pairs.length },
      skipped: parsed.skipped,
    };
  }

  return {
    pack: {
      v: PACK_VERSION,
      id: id || makePackId(),
      name: cleanName,
      emoji: clean(emoji).slice(0, 4) || '✏️',
      lang,
      // Hint mode describes a word by its category, and for a pack somebody
      // wrote, the pack's own name is the only category there is.
      hint: cleanName,
      custom: true,
      pairs: parsed.pairs,
    },
    skipped: parsed.skipped,
  };
}

/**
 * Checks a pack that arrived from somewhere else.
 *
 * A code from a friend, a room's host, or a line in localStorage that a
 * previous version wrote — none of it is trusted. Anything that is not a
 * pack comes back null rather than throwing, because a bad pack should cost
 * you a pack and not the evening.
 */
/**
 * Brings a saved pack up to the current shape.
 *
 * A pack with no version at all is from before there were versions, and that
 * shape happens to be identical to version 1 — so the migration is a stamp.
 * Later shapes get a step each, in order, and anything that cannot be
 * migrated comes back null.
 *
 * A pack from a *newer* version than this build is read anyway, with the
 * fields this build knows. That is a deliberate choice over refusing it: the
 * two fields that carry the actual work, the name and the pairs, have been
 * there since the beginning, and dropping somebody's words because they
 * opened an older build would be a worse answer than ignoring a field we do
 * not understand yet.
 */
export function migratePack(value) {
  if (!value || typeof value !== 'object') return null;
  const version = Number.isInteger(value.v) ? value.v : 0;
  if (version === 0) return { ...value, v: 1 }; // the shape before there were numbers
  return value;
}

/**
 * Is there a word in here at all?
 *
 * A pack may hold anything a person can type, which turned out to include
 * `???`, `!!!` and `,,,` — strings the engine's `normalise` reduces to
 * nothing, because it keeps only letters, digits and marks. Dealt as the
 * secret, such a word could not be guessed by typing it and could not be
 * hinted at; it could only be "matched" by typing nothing.
 *
 * Deliberately not `normalise` itself: the reducer imports this file, so
 * importing the engine back would close a cycle. One letter or one digit
 * anywhere is the whole question, and a regex answers it on its own.
 */
const hasAWord = (s) => /[\p{L}\p{N}]/u.test(s);

export function validatePack(input, lang) {
  const value = migratePack(input);
  if (!value || typeof value !== 'object') return null;
  const name = clean(value.name).slice(0, PACK_LIMITS.name);
  if (!name) return null;
  if (!Array.isArray(value.pairs)) return null;

  const seen = new Set();
  const pairs = [];
  for (const entry of value.pairs) {
    if (pairs.length >= PACK_LIMITS.pairs) break;
    if (!entry || typeof entry !== 'object') continue;
    const word = clean(entry.word).slice(0, PACK_LIMITS.word);
    if (!word || !hasAWord(word) || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const decoy = clean(entry.decoy).slice(0, PACK_LIMITS.word);
    const usable = decoy && hasAWord(decoy) && decoy.toLowerCase() !== word.toLowerCase();
    pairs.push({ word, decoy: usable ? decoy : null });
  }
  if (pairs.length < PACK_LIMITS.minPairs) return null;

  return {
    v: PACK_VERSION,
    id: isCustomPackId(value.id) ? value.id : makePackId(),
    name,
    emoji: clean(value.emoji).slice(0, 4) || '✏️',
    lang: value.lang || lang || 'en',
    hint: clean(value.hint).slice(0, PACK_LIMITS.name) || name,
    custom: true,
    pairs,
  };
}

/* ------------------------------------------------------------------ *
 * Sharing
 *
 * A pack becomes one string you can paste into a chat. The text form is the
 * same shape somebody would type — a header line, then the entries — so a
 * code that gets mangled in transit can still be read by a human, and the
 * base64 is only there to survive being pasted through apps that would
 * otherwise eat the line breaks.
 * ------------------------------------------------------------------ */

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64 = (code) => {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** The pack as one long string, safe to paste anywhere. */
export function encodePack(pack) {
  const header = [pack.name, pack.emoji, pack.lang].join('\u0001');
  return CODE_PREFIX + toBase64([header, toText(pack.pairs)].join('\n'));
}

/**
 * Reads a code back into a pack, or returns null.
 *
 * Whitespace is stripped first: a code pasted out of a chat app arrives with
 * line breaks in it more often than not.
 */
export function decodePack(code) {
  const trimmed = String(code ?? '').replace(/\s+/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) return null;
  try {
    const text = fromBase64(trimmed.slice(CODE_PREFIX.length));
    const [header, ...lines] = text.split('\n');
    const [name, emoji, lang] = header.split('\u0001');
    const built = buildPack({ name, emoji, lang, text: lines.join('\n') });
    return built.pack ?? null;
  } catch {
    return null;
  }
}
