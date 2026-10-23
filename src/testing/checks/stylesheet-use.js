/**
 * Class names the stylesheet styles and nothing renders.
 *
 * The stylesheet grew by appending for twenty versions. A screen gets
 * rewritten, its rules stay, and nothing says so — the page looks right, the
 * file is bigger than the app, and the next person to read it cannot tell
 * which half is load-bearing.
 *
 * This reads both sides: every class the stylesheet mentions in a selector,
 * and every class the JSX can put on an element. A class in the first list
 * and not the second is styling nothing.
 *
 * It is deliberately generous about what counts as rendered, because the cost
 * of being wrong is somebody deleting a rule that a screen needed. A class
 * built up in a template — `btn ${kind}` — makes every word in that template
 * count, and a class named in any string anywhere counts.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { sourceFiles } from './names.js';

/** Every class a selector in this stylesheet mentions. */
export function classesStyled(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set();
  // Only the selector side of a rule: a class name inside a declaration is
  // a value, not a selector.
  for (const [, selector] of code.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const head = selector.trim();
    if (head.startsWith('@') || /^(from|to|\d+%)/.test(head)) continue;
    for (const [, name] of head.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(name);
  }
  return out;
}

/**
 * Every class the project could put on an element.
 *
 * Any word inside any string literal counts, which is coarse on purpose:
 * `className={`btn ${kind} ${on ? 'on' : ''}`}` has to make `btn`, `on` and
 * whatever `kind` holds all count, and chasing that properly means running
 * the app. The browser sweep is what proves a screen renders; this only has
 * to be sure it never deletes something real.
 */
export function classesRendered(root) {
  const out = new Set();
  for (const file of sourceFiles(root)) {
    if (file.includes(`${path.sep}styles${path.sep}`)) continue;
    // Every word in the file, not only the ones inside quotes. Matching
    // quotes with a regex is how the first version of this went wrong: a
    // template literal containing an apostrophe desynchronised the pairing
    // and everything after it in the file was skipped, so `langpicker` and
    // `pack-row` — both written out in full, in plain JSX — were reported as
    // styling nothing. Reading every word cannot make that mistake, and
    // being too generous here only means a dead rule survives another day.
    for (const word of readFileSync(file, 'utf8').split(/[^\w-]+/)) {
      if (word) out.add(word);
    }
  }
  return out;
}

/**
 * Beginnings of class names that are finished at runtime.
 *
 * `` `tag role-${roles[id]}` `` puts `role-detective` on an element without
 * the word `role-detective` appearing anywhere. Every piece of text sitting
 * immediately before a `${` is one of these, and any styled class that
 * starts with one has to count as rendered — otherwise the sweep
 * confidently reports three roles' worth of styling as dead.
 */
export function classPrefixes(root) {
  const out = new Set();
  for (const file of sourceFiles(root)) {
    if (file.includes(`${path.sep}styles${path.sep}`)) continue;
    const code = readFileSync(file, 'utf8');
    for (const [, before] of code.matchAll(/([\w-]+)\$\{/g)) out.add(before);
  }
  return out;
}

/** Classes the stylesheet styles that nothing appears to render. */
export function unusedClasses(css, root) {
  const rendered = classesRendered(root);
  const prefixes = [...classPrefixes(root)];
  return [...classesStyled(css)]
    .filter((name) => !rendered.has(name))
    .filter((name) => !prefixes.some((p) => name.startsWith(p)))
    .sort();
}
