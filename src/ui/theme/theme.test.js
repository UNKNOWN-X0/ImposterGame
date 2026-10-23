/**
 * The themes, checked as data rather than looked at.
 *
 * Five colour families times light and dark is ten palettes, and a person
 * reviewing them by eye will look at two and assume the rest. These are the
 * rules that actually matter — every palette declares every token, and every
 * pairing that ends up as text on a background clears the contrast it needs
 * — so a new theme cannot be added half-finished and an edit to an old one
 * cannot quietly make it unreadable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { THEMES, MODES } from './themes.js';
import '../../testing/ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = path.join(here, '..', 'styles');

/**
 * The stylesheet as the browser ends up with it: index.css is a list of
 * imports, so this follows them in order rather than reading one file and
 * finding no colours in it.
 */
const index = readFileSync(path.join(styles, 'index.css'), 'utf8');
const parts = [...index.matchAll(/@import\s+'\.\/([\w-]+\.css)';/g)].map((m) => m[1]);
assert.ok(parts.length > 1, 'index.css should import the parts of the stylesheet');
const css = parts.map((file) => readFileSync(path.join(styles, file), 'utf8')).join('\n');

/** Pulls `--token: value` pairs out of one `[data-theme=…][data-mode=…]` block. */
function palette(theme, mode) {
  const head = `[data-theme='${theme}'][data-mode='${mode}'] {`;
  const start = css.indexOf(head);
  assert.notEqual(start, -1, `no block for ${theme}/${mode}`);
  const body = css.slice(start + head.length, css.indexOf('}', start));
  const out = {};
  for (const line of body.split('\n')) {
    const m = /^\s*(--[\w-]+):\s*(.+);\s*$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const luminance = (hex) => {
  const h = hex.replace('#', '');
  const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = parts.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrast = (a, b) => {
  const la = luminance(a) + 0.05;
  const lb = luminance(b) + 0.05;
  return Math.round((Math.max(la, lb) / Math.min(la, lb)) * 100) / 100;
};

const ALL = THEMES.flatMap((t) => ['dark', 'light'].map((mode) => [t.id, mode]));

test('every palette declares the same tokens', () => {
  const reference = Object.keys(palette('midnight', 'dark')).sort();
  assert.ok(reference.length > 15, 'the reference palette looks too small');
  for (const [theme, mode] of ALL) {
    assert.deepEqual(
      Object.keys(palette(theme, mode)).sort(),
      reference,
      `${theme}/${mode} does not declare the same tokens as midnight/dark`,
    );
  }
});

test('every token is a plain hex colour', () => {
  for (const [theme, mode] of ALL) {
    for (const [token, value] of Object.entries(palette(theme, mode))) {
      assert.match(value, /^#[0-9a-f]{6}$/i, `${theme}/${mode} ${token} is ${value}`);
    }
  }
});

test('text is readable on every surface it can land on, in every palette', () => {
  const surfaces = ['--bg', '--bg-soft', '--surface', '--surface-2'];
  for (const [theme, mode] of ALL) {
    const p = palette(theme, mode);
    for (const text of ['--text', '--text-dim', '--text-faint']) {
      for (const surface of surfaces) {
        const ratio = contrast(p[text], p[surface]);
        assert.ok(
          ratio >= 4.5,
          `${theme}/${mode}: ${text} on ${surface} is ${ratio}:1, needs 4.5`,
        );
      }
    }
  }
});

test('a label on a filled button is readable on the fill', () => {
  const pairs = [
    ['--on-accent', '--accent'],
    ['--on-crew', '--crew'],
    ['--on-imposter', '--imposter'],
  ];
  for (const [theme, mode] of ALL) {
    const p = palette(theme, mode);
    for (const [ink, fill] of pairs) {
      const ratio = contrast(p[ink], p[fill]);
      assert.ok(ratio >= 4.5, `${theme}/${mode}: ${ink} on ${fill} is ${ratio}:1`);
    }
  }
});

test('the accent can be read as text, which is what accent-text is for', () => {
  // `--accent` is a fill and may be bright; `--accent-text` is the version
  // used wherever the accent paints words or an icon on a plain surface.
  for (const [theme, mode] of ALL) {
    const p = palette(theme, mode);
    for (const on of ['--surface', '--bg', '--accent-deep']) {
      const ratio = contrast(p['--accent-text'], p[on]);
      assert.ok(ratio >= 4.5, `${theme}/${mode}: --accent-text on ${on} is ${ratio}:1`);
    }
  }
});

test('crew and imposter stay legible against their own backgrounds', () => {
  for (const [theme, mode] of ALL) {
    const p = palette(theme, mode);
    assert.ok(contrast(p['--crew'], p['--crew-deep']) >= 4.5, `${theme}/${mode}: crew on crew-deep`);
    assert.ok(
      contrast(p['--imposter'], p['--imposter-deep']) >= 4.5,
      `${theme}/${mode}: imposter on imposter-deep`,
    );
    // They are also read as large shapes on an ordinary card.
    assert.ok(contrast(p['--crew'], p['--surface']) >= 3, `${theme}/${mode}: crew on surface`);
    assert.ok(
      contrast(p['--imposter'], p['--surface']) >= 3,
      `${theme}/${mode}: imposter on surface`,
    );
  }
});

test('light really is light and dark really is dark', () => {
  for (const theme of THEMES.map((t) => t.id)) {
    assert.ok(
      luminance(palette(theme, 'light')['--bg']) > 0.7,
      `${theme}/light has a dark page`,
    );
    assert.ok(luminance(palette(theme, 'dark')['--bg']) < 0.1, `${theme}/dark has a light page`);
  }
});

test('the swatch a theme shows in the picker is a colour from that theme', () => {
  // The picker paints its chips from constants rather than from the CSS, so
  // they can drift. Near enough is fine; unrecognisable is not.
  for (const theme of THEMES) {
    for (const mode of ['dark', 'light']) {
      const [surface, accent] = theme[mode];
      const p = palette(theme.id, mode);
      assert.ok(
        contrast(surface, p['--surface']) < 1.6,
        `${theme.id}/${mode}: the swatch surface ${surface} is nothing like ${p['--surface']}`,
      );
      assert.ok(
        contrast(accent, p['--accent-text']) < 1.9,
        `${theme.id}/${mode}: the swatch accent ${accent} is nothing like ${p['--accent-text']}`,
      );
    }
  }
});

test('the modes on offer are the three the stylesheet can answer', () => {
  assert.deepEqual(MODES, ['system', 'light', 'dark']);
  for (const mode of ['light', 'dark']) {
    assert.ok(css.includes(`[data-mode='${mode}'] {`), `no block of its own for ${mode}`);
  }
});
