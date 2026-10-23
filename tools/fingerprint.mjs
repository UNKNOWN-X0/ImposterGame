/**
 * The behaviour fingerprint, from the command line.
 *
 *   node tools/fingerprint.mjs                 print the hash of this code
 *   node tools/fingerprint.mjs --dump FILE     write all the lines out, to diff
 *   node tools/fingerprint.mjs --write         record this hash as the blessed one
 *
 * The usual shape of an intended change: dump before, dump after, diff the
 * two, read it, and only then --write. The hash alone tells you something
 * moved; the dump tells you what.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Waits for every language: the packs are fetched one at a time now, and a
// fingerprint of a game with no words in it is worse than no fingerprint.
import '../src/testing/ready.js';
import { behaviour } from '../src/testing/fingerprint.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'src', 'testing', 'fingerprint.sha256');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => args[args.indexOf(name) + 1];

const { lines, text, hash } = behaviour();
console.log(`lines   ${lines.length}`);
console.log(`sha256  ${hash}`);

if (flag('--dump')) {
  const out = value('--dump');
  if (!out) {
    console.error('--dump needs a file to write to');
    process.exit(2);
  }
  writeFileSync(out, `${text}\n`);
  console.log(`dumped  ${out}`);
}

if (flag('--write')) {
  const was = readFileSync(file, 'utf8');
  const now = was
    .replace(/^lines\s+\d+$/m, `lines  ${lines.length}`)
    .replace(/^sha256\s+\S+$/m, `sha256 ${hash}`);
  if (now === was) {
    console.log('blessed already — nothing changed');
  } else {
    writeFileSync(file, now);
    console.log(`blessed ${path.relative(path.join(here, '..'), file)}`);
  }
}

// Say plainly whether this run matches, so the command is useful on its own.
if (!flag('--write')) {
  const blessed = /^sha256\s+(\S+)/m.exec(readFileSync(file, 'utf8'))?.[1];
  console.log(hash === blessed ? 'matches the blessed run' : 'DIFFERS from the blessed run');
}
