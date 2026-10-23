/**
 * The fingerprint, checked against the hash committed beside it.
 *
 * A failure here is not like other failures. Nothing is "broken" — the game
 * simply does something different from what it did when the hash was
 * blessed. Read the diff before you touch anything:
 *
 *   node tools/fingerprint.mjs --dump /tmp/now.txt
 *   git stash && node tools/fingerprint.mjs --dump /tmp/before.txt && git stash pop
 *   diff /tmp/before.txt /tmp/now.txt
 *
 * If the difference is what you meant, record it: node tools/fingerprint.mjs --write
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { behaviour } from './fingerprint.js';
import './ready.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The blessed numbers, read out of the committed file. */
export function blessed(file = path.join(here, 'fingerprint.sha256')) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [, key, value] = /^(\w+)\s+(\S+)/.exec(line) ?? [];
    if (key) out[key] = value;
  }
  return { lines: Number(out.lines), sha256: out.sha256 };
}

test('the game behaves exactly as it did when the hash was blessed', () => {
  const expected = blessed();
  const actual = behaviour();

  assert.equal(
    actual.lines.length,
    expected.lines,
    `the fingerprint is ${actual.lines.length} lines, not ${expected.lines} — ` +
      'the game does more or less than it did. Read the diff before re-blessing.',
  );
  assert.equal(
    actual.hash,
    expected.sha256,
    'the game behaves differently from the blessed run.\n' +
      '  Read the diff:   node tools/fingerprint.mjs --dump /tmp/now.txt\n' +
      '  Meant it?        node tools/fingerprint.mjs --write',
  );
});

test('the fingerprint is the same every time it is taken', () => {
  // If this fails, something in the rules is reading the clock or an
  // unseeded random, and the check above is only passing by luck.
  assert.equal(behaviour().hash, behaviour().hash);
});
