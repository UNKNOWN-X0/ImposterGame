/**
 * Every language, in memory, before a test asks for one.
 *
 * The word packs and the Thai and German strings are fetched a language at a
 * time now, so that a phone does not download two languages nobody at the
 * table is reading. That is right for a phone and wrong for a test: a test
 * that deals a game needs the words there, and a test that compares the
 * three string tables needs all three.
 *
 * Importing this file waits for them. It is a module with a top-level await,
 * so `import './ready.js'` at the top of a test file is enough — the test
 * body does not run until the loading has finished, and importing it from
 * twenty files costs one load, not twenty.
 */

import { loadAllWords } from '../content/words/index.js';
import { loadAllStrings } from '../i18n/strings/index.js';

await Promise.all([loadAllWords(), loadAllStrings()]);
