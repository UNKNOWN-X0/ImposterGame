/**
 * The stylesheet as a structure.
 *
 * This exists because a stray `}` sat in the middle of the stylesheet for
 * several versions. A browser skips a closing brace that closes nothing, and
 * so did the bundler used while developing, so the game looked right
 * everywhere it was tried — until a stricter CSS parser refused to build it.
 *
 * Reads the file the way that stricter parser does: comments and strings
 * first, then braces, with no error recovery.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** The parts, in the order index.css imports them. */
export function stylesheetParts(dir) {
  const index = readFileSync(path.join(dir, 'index.css'), 'utf8');
  return [...index.matchAll(/@import\s+'\.\/([\w-]+\.css)';/g)].map((m) => m[1]);
}

/** Every .css file actually sitting in the folder, except the index. */
export const cssFilesIn = (dir) =>
  readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'index.css').sort();

/**
 * Parse one stylesheet strictly.
 *
 * Returns what a parser would complain about: braces that close nothing,
 * blocks left open at the end, an unterminated comment or string.
 */
export function parseStrictly(css) {
  const open = [];
  const strays = [];
  let unterminated = null;
  let line = 1;
  let i = 0;

  while (i < css.length) {
    const ch = css[i];
    if (ch === '\n') {
      line += 1;
      i += 1;
    } else if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0) {
        unterminated = { what: 'comment', line };
        break;
      }
      line += css.slice(i, end).split('\n').length - 1;
      i = end + 2;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1;
      if (j >= css.length || css[j] === '\n') {
        unterminated = { what: 'string', line };
        break;
      }
      i = j + 1;
    } else {
      if (ch === '{') open.push(line);
      if (ch === '}') (open.length ? open.pop() : strays.push(line));
      i += 1;
    }
  }

  return { strays, stillOpen: open, unterminated };
}

/** Anything a build would not be able to fetch. */
export function unreachableAssets(css) {
  const out = [];
  for (const [, spec] of css.matchAll(/@import\s+'([^']+)'/g)) {
    if (!spec.startsWith('./')) out.push(`@import '${spec}'`);
  }
  for (const [, spec] of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    if (!/^(data:|https?:|\/|\.\/)/.test(spec)) out.push(`url(${spec})`);
  }
  return out;
}
