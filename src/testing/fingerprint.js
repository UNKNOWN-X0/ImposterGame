/**
 * A fingerprint of how the game behaves.
 *
 * This is the proof that a refactor was a refactor. It plays 400 games by a
 * fixed script, across every language, every decoy mode, every imposter
 * setting and every combination of roles; it writes down every word in every
 * pack, every string in every language, and what the reader makes of them;
 * and it hashes the lot. Move a file, split a component, rename an export —
 * the hash should not move. If it does, something about the game changed,
 * and the only question is whether that was the point.
 *
 * It was written for the six-folder restructure, where it ran before and
 * after and matched to the byte. It lives here now rather than in a scratch
 * folder so the next refactor has something to prove itself against.
 *
 * The hash of a good run is committed beside this file in `fingerprint.sha256`
 * and checked by `fingerprint.test.js`. After an intended change to the rules
 * or the words, read the diff first, then re-bless it:
 *
 *   node tools/fingerprint.mjs --dump before.txt   # before your change
 *   node tools/fingerprint.mjs --dump after.txt    # after it
 *   diff before.txt after.txt                      # is this what you meant?
 *   node tools/fingerprint.mjs --write             # yes: record the new hash
 *
 * Two rules keep it honest:
 *
 *  - Nothing minted from the clock is ever printed. Player ids are made from
 *    the time, so they differ every run; every id is replaced by its seat
 *    before it reaches a line. Without this the fingerprint is random noise
 *    that happens to be the right length.
 *  - A refused action is part of the behaviour, so it is recorded by its
 *    error code rather than allowed to end the run.
 */

import { createHash } from 'node:crypto';

import { createGame, reduce, publicState, currentTurn } from '../core/engine.js';
import { packsFor, wordsReady } from '../content/words/index.js';
import { translate } from '../i18n/translate.js';
import { STRINGS } from '../i18n/strings/index.js';

/** Player ids come from the clock; print the seat instead. */
const bySeat = (state) => {
  const map = new Map(state.players.map((p, i) => [p.id, `P${i}`]));
  return (text) => {
    let out = String(text);
    for (const [id, name] of map) out = out.split(id).join(name);
    return out;
  };
};

const NAMES = ['Ann', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal'];

/** Every word in every pack, in the order the game would see them. */
function words(lines) {
  for (const lang of ['en', 'th', 'de']) {
    for (const pack of packsFor(lang)) {
      lines.push(`pack ${lang}/${pack.id} ${pack.emoji} ${pack.name} :: ${pack.hint}`);
      for (const p of pack.pairs) lines.push(`  ${p.word}|${p.decoy ?? ''}`);
    }
  }
}

/** Every string, and what the reader makes of the awkward ones. */
function strings(lines) {
  for (const lang of Object.keys(STRINGS).sort()) {
    for (const key of Object.keys(STRINGS[lang]).sort()) {
      lines.push(`str ${lang} ${key} = ${STRINGS[lang][key]}`);
    }
  }
  for (const lang of ['en', 'th', 'de']) {
    for (const count of [0, 1, 2, 5, 1000, 3000]) {
      for (const key of ['packs.count', 'settings.packsAll', 'vote.count', 'log.earlier']) {
        lines.push(`t ${lang} ${key} ${count} = ${translate(lang, key, { count })}`);
      }
    }
  }
}

/** 400 whole games, played to the end by a script that never improvises. */
function games(lines) {
  for (let seed = 1; seed <= 400; seed += 1) {
    const seats = 4 + (seed % 5);
    let state = createGame({
      wordLang: ['en', 'th', 'de'][seed % 3],
      decoyMode: ['blank', 'related', 'unrelated', 'hint'][seed % 4],
      imposterCount: seed % 11 === 0 ? 2 : seed % 7 === 0 ? 'random' : 'auto',
      imposterKnows: seed % 13 !== 0,
      allowSteal: seed % 5 !== 0,
      allowCall: seed % 4 !== 0,
      maxRounds: [2, 3, 4, 5, 0][seed % 5],
      roles:
        seed % 3 === 0 ? ['detective', 'sidekick', 'jester'] : seed % 3 === 1 ? ['detective'] : [],
      scoring: seed % 2 === 0,
    });
    for (const n of NAMES.slice(0, seats)) state = reduce(state, { type: 'ADD_PLAYER', name: n });
    state = reduce(state, { type: 'START_GAME', seed });

    const at = () => `${state.phase}|${state.round}|${state.result?.reason ?? '-'}`;
    const seat = bySeat(state);

    lines.push(
      `game ${seed} deal ${state.secretWord}|${state.imposterWord ?? ''}|` +
        `${state.imposterHint ?? ''}|${state.packId}`,
    );
    lines.push(
      seat(
        `game ${seed} roles ${JSON.stringify(state.roles)} ` +
          `imposters ${state.imposterIds.join(',')} cleared ${state.clearedId ?? '-'}`,
      ),
    );
    lines.push(seat(`game ${seed} order ${state.order.join(',')}`));
    lines.push(
      `game ${seed} wire ${createHash('sha256')
        .update(seat(JSON.stringify(publicState(state))))
        .digest('hex')
        .slice(0, 16)}`,
    );

    for (const id of state.order) state = reduce(state, { type: 'MARK_REVEALED', playerId: id });

    const step = (action) => {
      try {
        state = reduce(state, action);
      } catch (e) {
        lines.push(`game ${seed} refused ${action.type} ${e.code}`);
      }
    };

    let guard = 0;
    while (state.phase !== 'gameOver' && guard++ < 60) {
      const was = state.phase;
      if (state.phase === 'clues') {
        const turn = state.order[state.clues.length % state.order.length];
        step({ type: 'SUBMIT_CLUE', playerId: turn, text: `clue${guard}` });
        // An imposter who fancies it calls the word rather than bluffing on.
        if (state.phase === 'clues' && seed % 9 === 0 && guard === 3) {
          step({ type: 'CALL_WORD', playerId: state.imposterIds[0], text: state.secretWord });
        }
        if (state.phase === 'clues' && guard > 24) step({ type: 'FORCE_VOTE' });
      } else if (state.phase === 'vote') {
        const alive = state.players.filter((p) => !state.eliminated.includes(p.id));
        for (const [i, p] of alive.entries()) {
          const target = alive[(i + seed) % alive.length];
          if (target.id === p.id || state.phase !== 'vote') continue;
          step({ type: 'CAST_VOTE', voterId: p.id, targetId: target.id });
        }
        // Half the tables vote in the app; the other half vote by hand and
        // whoever holds the phone declares it.
        if (state.phase === 'vote') {
          const alive2 = state.players.filter((q) => !state.eliminated.includes(q.id));
          const jester = alive2.find((q) => state.roles[q.id] === 'jester');
          const imposter = alive2.find((q) => state.imposterIds.includes(q.id));
          const innocent = alive2.find((q) => !state.imposterIds.includes(q.id));
          // Every way a vote can land: straight to the imposter, the jester,
          // a tie, and — the case that pays differently — somebody innocent
          // first and the imposter afterwards, which is a win that cost them.
          const pick =
            seed % 5 === 0 ? (imposter ?? alive2[0])
            : seed % 5 === 1 ? (jester ?? alive2[0])
            : seed % 5 === 2 ? null
            : seed % 5 === 3 ? ((state.round <= 1 ? innocent : imposter) ?? alive2[0])
            : (innocent ?? alive2[0]);
          step({ type: 'DECLARE_ELIMINATION', playerId: pick?.id ?? null });
        }
      } else if (state.phase === 'verdict') {
        step({ type: 'CONTINUE' });
      } else if (state.phase === 'steal') {
        step({ type: 'STEAL_GUESS', text: seed % 5 === 0 ? state.secretWord : 'not the word' });
      } else break;
      lines.push(`game ${seed} step ${guard} ${at()}`);
      if (state.phase === was && was === 'clues' && guard > 50) break;
    }
    lines.push(
      seat(
        `game ${seed} end ${JSON.stringify(state.result)} scores ${JSON.stringify(state.scores)}`,
      ),
    );
  }
}

/**
 * The three endings a broad sweep almost never reaches, driven on purpose:
 * a win that cost the crew somebody, and both halves of the final guess.
 */
function scripted(lines) {
  for (const [name, allowSteal, guessRight] of [
    ['caught', false, false],
    ['steal-right', true, true],
    ['steal-wrong', true, false],
  ]) {
    let g = createGame({
      wordLang: 'en',
      decoyMode: 'related',
      imposterCount: 1,
      allowSteal,
      scoring: true,
    });
    for (const n of NAMES.slice(0, 6)) g = reduce(g, { type: 'ADD_PLAYER', name: n });
    g = reduce(g, { type: 'START_GAME', seed: 99 });
    for (const id of g.order) g = reduce(g, { type: 'MARK_REVEALED', playerId: id });

    const impostor = g.imposterIds[0];
    const innocent = g.players.find((p) => !g.imposterIds.includes(p.id));

    // Whoever the engine says is up, rather than a guess at the order.
    let said = 0;
    const speak = () => {
      while (g.phase === 'clues') {
        const turn = currentTurn(g);
        if (!turn) break;
        g = reduce(g, { type: 'SUBMIT_CLUE', playerId: turn, text: `c${said++}` });
      }
    };

    speak();
    // Round one: the crew get it wrong and lose one of their own.
    g = reduce(g, { type: 'DECLARE_ELIMINATION', playerId: innocent.id });
    g = reduce(g, { type: 'CONTINUE' });
    speak();
    // Round two: they get it right, which is a win that cost them somebody.
    g = reduce(g, { type: 'DECLARE_ELIMINATION', playerId: impostor });
    // The verdict is read out first; the final guess comes after it.
    if (g.phase === 'verdict') g = reduce(g, { type: 'CONTINUE' });
    if (g.phase === 'steal') {
      g = reduce(g, { type: 'STEAL_GUESS', text: guessRight ? g.secretWord : 'not the word' });
    }
    if (g.phase === 'verdict') g = reduce(g, { type: 'CONTINUE' });
    lines.push(
      bySeat(g)(`scripted ${name} ${JSON.stringify(g.result)} scores ${JSON.stringify(g.scores)}`),
    );
  }
}

/** Everything above, as lines, as one string, and as one hash. */
export function behaviour() {
  // The packs are fetched a language at a time now. A fingerprint taken
  // before they arrive would be a perfectly valid-looking hash of a game with
  // no words in it — which is exactly the kind of thing somebody would bless
  // by accident and then spend an afternoon puzzling over.
  for (const lang of ['en', 'th', 'de']) {
    if (!wordsReady(lang)) {
      throw new Error(
        `the ${lang} word packs are not loaded, so this fingerprint would be ` +
          'missing every word. Import src/testing/ready.js first.',
      );
    }
  }

  const lines = [];
  words(lines);
  strings(lines);
  games(lines);
  scripted(lines);
  const text = lines.join('\n');
  return { lines, text, hash: createHash('sha256').update(text).digest('hex') };
}
