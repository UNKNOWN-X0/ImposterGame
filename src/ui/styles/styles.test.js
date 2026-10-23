/**
 * The stylesheet, checked as a structure rather than as a look.
 *
 * This exists because of a bug that shipped: a stray `}` sat in the middle of
 * the stylesheet for several versions. Browsers skip a closing brace that
 * closes nothing, and so did the bundler used while developing, so the game
 * looked right and the file was wrong — until Vite's CSS parser, which is
 * stricter, refused to build it.
 *
 * These are the checks that would have caught it on the day.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { unusedClasses } from '../../testing/checks/stylesheet-use.js';
import '../../testing/ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const index = readFileSync(path.join(here, 'index.css'), 'utf8');
const parts = [...index.matchAll(/@import\s+'\.\/([\w-]+\.css)';/g)].map((m) => m[1]);

/** Comments removed, newlines kept, so a reported line number is the real one. */
const code = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

function braces(css) {
  let depth = 0;
  let line = 1;
  const strays = [];
  for (const ch of code(css)) {
    if (ch === '\n') line += 1;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth < 0) {
        strays.push(line);
        depth = 0;
      }
    }
  }
  return { depth, strays };
}

test('index.css lists every part, and every part exists', () => {
  assert.ok(parts.length > 1, 'the stylesheet should be in parts');
  const onDisk = readdirSync(here)
    .filter((f) => f.endsWith('.css') && f !== 'index.css')
    .sort();
  assert.deepEqual([...parts].sort(), onDisk, 'a part is listed but missing, or present but unread');
});

test('no part closes a block it did not open', () => {
  for (const name of parts) {
    const { strays } = braces(readFileSync(path.join(here, name), 'utf8'));
    assert.deepEqual(strays, [], `${name}: a } that closes nothing, at line ${strays[0]}`);
  }
});

test('no part leaves a block open at the end of the file', () => {
  for (const name of parts) {
    const { depth } = braces(readFileSync(path.join(here, name), 'utf8'));
    assert.equal(depth, 0, `${name}: ${depth} block(s) still open at the end`);
  }
});

test('every comment is closed', () => {
  for (const name of ['index.css', ...parts]) {
    const css = readFileSync(path.join(here, name), 'utf8');
    const opens = (css.match(/\/\*/g) || []).length;
    const closes = (css.match(/\*\//g) || []).length;
    assert.equal(opens, closes, `${name}: ${opens} comments opened, ${closes} closed`);
  }
});

test('the whole stylesheet balances, in the order it is imported', () => {
  const whole = parts.map((n) => readFileSync(path.join(here, n), 'utf8')).join('\n');
  const { depth, strays } = braces(whole);
  assert.deepEqual(strays, [], 'a stray } somewhere in the stylesheet');
  assert.equal(depth, 0);
});

test('nothing imports anything the bundler cannot reach', () => {
  // A url() or @import pointing outside the project is a build that works
  // here and fails on somebody else's machine.
  for (const name of ['index.css', ...parts]) {
    const css = readFileSync(path.join(here, name), 'utf8');
    for (const [, spec] of css.matchAll(/@import\s+'([^']+)'/g)) {
      assert.ok(spec.startsWith('./'), `${name}: @import '${spec}' is not a sibling`);
    }
    for (const [, spec] of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      assert.ok(
        spec.startsWith('data:') || spec.startsWith('/') || spec.startsWith('./'),
        `${name}: url(${spec}) will not resolve in a build`,
      );
    }
  }
});

/* ------------------------------------------------------------------ *
 * Motion, and the readers who asked for none
 * ------------------------------------------------------------------ */

const motion = readFileSync(path.join(here, 'motion.css'), 'utf8');
const withoutComments = code(motion);
const gateAt = withoutComments.indexOf('@media (prefers-reduced-motion: no-preference)');

test('every animation is behind the one media query, not a list somebody maintains', () => {
  // It used to be three hand-written lists of `animation: none !important`,
  // and lists drift: of 41 things that animated, 27 were in none of them,
  // including every icon animation added after they were written. An
  // animation outside the gate is one that reaches a reader who asked their
  // phone for stillness.
  assert.ok(gateAt > 0, 'motion.css should have a no-preference block');
  const before = withoutComments.slice(0, gateAt);
  const escaped = [...before.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    ([, , body]) => /\banimation(-name)?\s*:/.test(body) && !/animation:\s*none/.test(body),
  );
  assert.deepEqual(
    escaped.map(([, sel]) => sel.trim()),
    [],
    'these animate outside the reduced-motion gate',
  );
});

test('nothing that is drawn on by its animation is left invisible without one', () => {
  // The trap in gating motion: an element hidden at rest and revealed by its
  // own animation becomes permanently hidden when the animation is gone. A
  // tick with no tick in it looks like a bug in the card, not a preference
  // being honoured.
  const gate = withoutComments.slice(gateAt);
  const animated = new Set();
  for (const [, sel, body] of gate.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/\banimation(-name)?\s*:/.test(body)) continue;
    for (const one of sel.split(',').map((x) => x.trim())) {
      if (one && !/^(from|to|\d+%)/.test(one)) animated.add(one);
    }
  }

  // What the reduce block puts back.
  const restored = new Set();
  for (const block of withoutComments.matchAll(
    /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g,
  )) {
    for (const [, sel] of block[1].matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      for (const one of sel.split(',').map((x) => x.trim())) restored.add(one);
    }
  }

  const stranded = [];
  for (const [, sel, body] of withoutComments.slice(0, gateAt).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const hiddenAtRest =
      /opacity\s*:\s*0\b/.test(body) ||
      /visibility\s*:\s*hidden/.test(body) ||
      /stroke-dashoffset\s*:\s*(?!0)/.test(body);
    if (!hiddenAtRest) continue;
    for (const one of sel.split(',').map((x) => x.trim())) {
      if (animated.has(one) && !restored.has(one)) stranded.push(one);
    }
  }

  assert.deepEqual(
    stranded,
    [],
    'hidden at rest, animated into view, and nothing puts them back under reduced motion',
  );
});

/* ------------------------------------------------------------------ *
 * Rules that style nothing
 * ------------------------------------------------------------------ */

const whole = parts.map((n) => readFileSync(path.join(here, n), 'utf8')).join('\n');
const projectRoot = path.join(here, '..', '..', '..');

test('nothing is styled that nothing renders', () => {
  // Twenty versions of appending. A screen gets rewritten, its rules stay,
  // and the page still looks right — so nothing ever says so.
  //
  // Deliberately generous: a class counts as rendered if the word appears
  // anywhere in any source file, or if any template in the project could
  // build it. The cost of a false "dead" is somebody deleting a rule a
  // screen needed; the cost of a false "alive" is one rule surviving a
  // little longer.
  const dead = unusedClasses(whole, projectRoot);
  assert.deepEqual(dead, [], `styled and never rendered: ${dead.join(', ')}`);
});

test('every animation named is an animation that exists', () => {
  const defined = new Set([...code(whole).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const named = new Set();
  for (const [, value] of code(whole).matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const word of value.split(/[\s,]+/)) {
      // The shorthand holds durations and easings too; only a word that is
      // not one of those can be a name.
      if (/^[a-z][\w-]*$/i.test(word) && !/^(none|ease|ease-in|ease-out|ease-in-out|linear|infinite|alternate|both|forwards|backwards|normal|reverse|running|paused|step-start|step-end)$/.test(word)) {
        named.add(word);
      }
    }
  }
  const missing = [...named].filter((n) => !defined.has(n)).sort();
  assert.deepEqual(missing, [], `named but never written: ${missing.join(', ')}`);

  const orphans = [...defined].filter((n) => !named.has(n)).sort();
  assert.deepEqual(orphans, [], `written but never named: ${orphans.join(', ')}`);
});
