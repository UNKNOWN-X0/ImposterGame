/**
 * The checks that are about the project rather than about the game.
 *
 * A unit test asks whether a function is right. These ask whether the code
 * will run at all, whether it will build on somebody else's machine, and
 * whether a player reading it in Thai gets Thai. Every one of them is here
 * because something in this list once shipped.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sourceFiles, stripNonCode, unresolvedNames } from './checks/names.js';
import { stylesheetParts, cssFilesIn, parseStrictly, unreachableAssets } from './checks/stylesheet.js';
import { linkedFiles, manifestIcons, missing, pngSize, inPublic } from './checks/icons.js';
import {
  askedKeys,
  answers,
  isBuiltAtRuntime,
  placeholderTrouble,
  readsAsUntranslated,
} from './checks/strings.js';
import { STRINGS, FALLBACK_LANG, LANGUAGES } from '../i18n/strings/index.js';
import './ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..');
const STYLES = path.join(SRC, 'ui', 'styles');
const relative = (file) => path.relative(path.join(SRC, '..'), file);

/* ---------------------------------------------------------------- *
 * Will it run?
 * ---------------------------------------------------------------- */

/**
 * The check above, checked.
 *
 * It was once narrow enough to miss a real crash: it looked at what a file
 * called and what it rendered, and `SPECIAL_ROLES.includes(role)` is neither,
 * so the verdict card shipped without its import and broke on a real phone
 * the first time somebody was voted out. These pin the width of the net, so
 * narrowing it again fails here rather than at a table.
 */
test('the check catches a constant used without being imported', () => {
  const file = path.join(tmpdir(), `imposter-check-${process.pid}.jsx`);
  writeFileSync(
    file,
    `import { useT } from './i18n.js';
     export function Card({ role }) {
       const { t } = useT();
       return <p>{SPECIAL_ROLES.includes(role) ? t('a') : t('b')}</p>;
     }`,
  );
  try {
    assert.deepEqual(unresolvedNames(file), ['SPECIAL_ROLES']);
  } finally {
    rmSync(file, { force: true });
  }
});

test('the check reads the code inside a template literal', () => {
  // `cup-${useId()}` is a file calling a hook. The text around it is text,
  // and blanking the whole literal hid exactly that crash from this check.
  const file = path.join(tmpdir(), `imposter-check-tpl-${process.pid}.jsx`);
  writeFileSync(
    file,
    'export const CoffeeIcon = (p) => {\n' +
      '  const clip = `cup-${useId()}`;\n' +
      '  const plain = `nothing but words in here`;\n' +
      '  return clip + plain;\n' +
      '};\n',
  );
  try {
    assert.deepEqual(unresolvedNames(file), ['useId']);
  } finally {
    rmSync(file, { force: true });
  }
});

test('the check is not fooled by what only looks like a name', () => {
  const file = path.join(tmpdir(), `imposter-check-quiet-${process.pid}.jsx`);
  writeFileSync(
    file,
    `import { useState } from 'react';
     const PHASE = { LOBBY: 'lobby', GAME_OVER: 'over' };
     const NAME = /^[A-Za-z]+$/;
     const MARKS = /\\p{M}/gu;
     const QUOTED = "SPECIAL_ROLES";
     const COMMENT = 1; // mentions Missing on purpose
     export function Credit({ at }) {
       const [n] = useState(0);
       return <p>Made by Thanate Amornjiraporn {PHASE.LOBBY} {String(NAME.test(at) || MARKS.test(at) || QUOTED || COMMENT || n)}</p>;
     }`,
  );
  try {
    assert.deepEqual(unresolvedNames(file), [], 'reported something that is not a missing import');
  } finally {
    rmSync(file, { force: true });
  }
});

test('no file calls or renders something it was never given', () => {
  // The bug this catches: a component that used useEffect without importing
  // it. The bundle was fine and the screen was white.
  const broken = [];
  for (const file of sourceFiles(SRC)) {
    const missing = unresolvedNames(file);
    if (missing.length) broken.push(`${relative(file)}: ${missing.join(', ')}`);
  }
  assert.deepEqual(broken, [], 'these files use a hook or a component nobody hands them');
});

test('every relative import points at a file that exists', () => {
  const broken = [];
  for (const file of sourceFiles(SRC)) {
    // Comments mention paths too, and a path in a sentence is not an import.
    const code = stripNonCode(readFileSync(file, 'utf8'));
    for (const [, spec] of code.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(file), spec);
      try {
        readFileSync(target);
      } catch {
        broken.push(`${relative(file)} -> ${spec}`);
      }
    }
  }
  assert.deepEqual(broken, [], 'these imports point at nothing');
});

test('nothing in core imports React, and nothing in ui imports the rules', () => {
  // The layering is the point of the folders. Once core imports React it
  // cannot be tested without a browser, and once ui imports the engine a
  // change to the rules starts breaking buttons.
  for (const file of sourceFiles(path.join(SRC, 'core'))) {
    const code = readFileSync(file, 'utf8');
    if (file.endsWith('.test.js')) continue;
    assert.ok(!/from 'react'/.test(code), `${relative(file)} imports React`);
  }
  for (const file of sourceFiles(path.join(SRC, 'ui'))) {
    if (file.endsWith('.test.js')) continue;
    const code = readFileSync(file, 'utf8');
    assert.ok(
      !/from '[^']*\/core\//.test(code) || /icons|RoleGlyph/.test(file),
      `${relative(file)} reaches into the rules`,
    );
  }
});

/* ---------------------------------------------------------------- *
 * Will it build?
 * ---------------------------------------------------------------- */

test('index.css lists exactly the stylesheet parts on disk', () => {
  assert.deepEqual([...stylesheetParts(STYLES)].sort(), cssFilesIn(STYLES));
});

test('every stylesheet part survives a strict parser', () => {
  for (const name of ['index.css', ...stylesheetParts(STYLES)]) {
    const css = readFileSync(path.join(STYLES, name), 'utf8');
    const { strays, stillOpen, unterminated } = parseStrictly(css);
    assert.equal(unterminated, null, `${name}: unterminated ${unterminated?.what} at line ${unterminated?.line}`);
    assert.deepEqual(strays, [], `${name}: a } that closes nothing, at line ${strays[0]}`);
    assert.deepEqual(stillOpen, [], `${name}: a block opened at line ${stillOpen[0]} is never closed`);
  }
});

test('the stylesheet balances as a whole, in the order it is imported', () => {
  const whole = stylesheetParts(STYLES)
    .map((n) => readFileSync(path.join(STYLES, n), 'utf8'))
    .join('\n');
  const { strays, stillOpen } = parseStrictly(whole);
  assert.deepEqual(strays, []);
  assert.deepEqual(stillOpen, []);
});

test('no stylesheet points at something a build cannot fetch', () => {
  for (const name of ['index.css', ...stylesheetParts(STYLES)]) {
    const bad = unreachableAssets(readFileSync(path.join(STYLES, name), 'utf8'));
    assert.deepEqual(bad, [], `${name} refers to something outside the project`);
  }
});

test('no barrel exports the same name twice', () => {
  // An explicit export quietly wins over a star export, which makes two
  // routes to one name look like it works until a bundler disagrees.
  for (const file of sourceFiles(SRC)) {
    const code = readFileSync(file, 'utf8');
    const stars = [...code.matchAll(/^export \* from '([^']+)';$/gm)].map((m) => m[1]);
    if (!stars.length) continue;
    const named = new Set();
    for (const group of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const n of group[1].split(',')) {
        const name = n.trim().split(/\s+as\s+/).pop().trim();
        if (name) named.add(name);
      }
    }
    for (const spec of stars) {
      const target = readFileSync(path.resolve(path.dirname(file), spec), 'utf8');
      const theirs = new Set([
        ...[...target.matchAll(/^export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]),
        ...[...target.matchAll(/^export\s*\{([^}]*)\}/gm)].flatMap((m) =>
          m[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean),
        ),
      ]);
      const clash = [...theirs].filter((n) => named.has(n));
      assert.deepEqual(clash, [], `${relative(file)}: ${clash.join(', ')} comes from both ${spec} and here`);
    }
  }
});

/* ---------------------------------------------------------------- *
 * Will it read properly?
 * ---------------------------------------------------------------- */

test('every string a screen asks for by name exists in English', () => {
  const missing = [];
  for (const [key, files] of askedKeys(SRC)) {
    if (isBuiltAtRuntime(key)) continue;
    if (!answers(STRINGS[FALLBACK_LANG], key)) {
      missing.push(`${key} (asked in ${files.map(relative).join(', ')})`);
    }
  }
  assert.deepEqual(missing, [], 'these keys are asked for and never written');
});

test('the three languages hold the same keys', () => {
  const english = Object.keys(STRINGS[FALLBACK_LANG]);
  for (const { id } of LANGUAGES) {
    if (id === FALLBACK_LANG) continue;
    const table = STRINGS[id];
    const missing = english.filter((k) => !(k in table) && !k.endsWith('_one'));
    assert.deepEqual(
      missing,
      [],
      `${id} is missing ${missing.length} strings, which would read as English mid-game`,
    );
    const extra = Object.keys(table).filter((k) => !(k in STRINGS[FALLBACK_LANG]));
    assert.deepEqual(extra, [], `${id} has strings English does not, so nothing falls back to them`);
  }
});

test('a string never asks for something the screen will not pass it', () => {
  // A placeholder the caller does not know about prints a word in braces to
  // somebody mid-game. Dropping {count} from a singular is allowed: that is
  // German being German.
  const trouble = [];
  for (const [key, english] of Object.entries(STRINGS[FALLBACK_LANG])) {
    for (const { id } of LANGUAGES) {
      const text = STRINGS[id][key];
      if (!text) continue;
      const problem = placeholderTrouble(key, english, text);
      if (problem) trouble.push(`${id} ${key}: ${problem}`);
    }
  }
  assert.deepEqual(trouble, [], 'placeholders disagree between languages');
});

test('no string is left as an English sentence in another language', () => {
  // Not a translation check — it catches a key copied across and never
  // translated, which is a different mistake from one nobody got to.
  const suspicious = [];
  for (const { id } of LANGUAGES) {
    if (id === FALLBACK_LANG) continue;
    for (const [key, text] of Object.entries(STRINGS[id])) {
      const english = STRINGS[FALLBACK_LANG][key];
      if (!english || text !== english) continue;
      // Identical is fine when there is nothing to translate: one word, a
      // number, a placeholder, a piece of punctuation.
      if (!readsAsUntranslated(text)) continue;
      suspicious.push(`${id} ${key}: "${text}"`);
    }
  }
  assert.deepEqual(suspicious, [], 'these read as English in another language');
});

/* ---------------------------------------------------------------- *
 * Will it look like an app?
 * ---------------------------------------------------------------- */

const ROOT = path.join(SRC, '..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifestPath = path.join(ROOT, 'public', 'manifest.webmanifest');

test('a phone saving this to a home screen is given an icon', () => {
  // iOS reads this tag and nothing else: not the SVG favicon, not the
  // manifest. Without it the home screen shows a blank square with a letter.
  const links = linkedFiles(html);
  const apple = links.find((l) => l.rel === 'apple-touch-icon');
  assert.ok(apple, 'no apple-touch-icon, so iOS has nothing to show');
  const file = inPublic(ROOT, apple.href);
  const size = pngSize(file);
  assert.ok(size, `${apple.href} is not a PNG, and iOS will not read anything else`);
  assert.ok(size.width >= 180 && size.width === size.height, `${apple.href} is ${size.width}×${size.height}`);
});

test('every file index.html points at is actually shipped', () => {
  const hrefs = linkedFiles(html)
    .map((l) => l.href)
    .filter((href) => href.startsWith('/') && !href.startsWith('/src/'));
  assert.deepEqual(missing(ROOT, hrefs), [], 'these are linked but not in public/');
});

test('the manifest is a manifest', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const key of ['name', 'short_name', 'start_url', 'display', 'background_color', 'theme_color']) {
    assert.ok(manifest[key], `the manifest says nothing about ${key}`);
  }
  assert.equal(manifest.display, 'standalone', 'saved to a home screen it should open as an app');
  // The colour behind the icon while it loads has to be the colour the app
  // actually is, or the first half-second is a white flash.
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  // The page's tag is only the starting value — the app rewrites it to
  // whatever the reader's theme actually is — but the value it starts at and
  // the colour behind the splash screen should be the same, or the app opens
  // on one colour and settles on another.
  assert.ok(
    html.includes(`content="${manifest.theme_color}"`),
    'the page and the manifest start on different colours',
  );
  assert.equal(manifest.background_color, manifest.theme_color);
  const fallback = readFileSync(path.join(SRC, 'ui', 'theme', 'index.jsx'), 'utf8');
  const [, used] = fallback.match(/getPropertyValue\('--bg'\)\.trim\(\) \|\| '(#[0-9a-f]{6})'/i) ?? [];
  assert.equal(used, manifest.theme_color, 'the theme colour falls back to a colour nothing else uses');
});

test('the server knows what a manifest is', () => {
  // Served as octet-stream, a phone may decline to read it at all — and the
  // game is its own server when it is played over wifi.
  const server = readFileSync(path.join(ROOT, 'server', 'server.js'), 'utf8');
  assert.match(server, /'\.webmanifest':\s*'application\/manifest\+json/, 'no type for .webmanifest');
  for (const ext of ['.png', '.svg']) {
    assert.ok(server.includes(`'${ext}'`), `the server has no type for ${ext}`);
  }
});

test('every icon the manifest promises exists, and is the size it claims', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const icons = manifestIcons(manifest);
  assert.ok(icons.length > 0, 'a manifest with no icons is a manifest Android ignores');
  assert.deepEqual(missing(ROOT, icons.map((i) => i.src)), [], 'promised but not shipped');

  for (const icon of icons) {
    if (!icon.declared) continue; // an SVG is any size it likes
    const size = pngSize(inPublic(ROOT, icon.src));
    assert.ok(size, `${icon.src} is declared as a PNG and is not one`);
    assert.deepEqual(
      [size.width, size.height],
      icon.declared,
      `${icon.src} says ${icon.declared.join('x')} and is ${size.width}x${size.height}`,
    );
  }
});

test('Android is given something it can crop without cutting the mark off', () => {
  // A phone crops a maskable icon to its own shape — a circle, a squircle —
  // and only the middle 80% is guaranteed to survive. An icon offered
  // without that purpose gets a white box drawn round it instead.
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const maskable = manifestIcons(manifest).filter((i) => i.purpose.includes('maskable'));
  assert.ok(maskable.length > 0, 'nothing is marked maskable, so Android will frame it');
  for (const icon of maskable) {
    const size = pngSize(inPublic(ROOT, icon.src));
    assert.ok(size.width >= 192, `${icon.src} is too small to be cropped from`);
  }
});

