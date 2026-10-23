/**
 * Names a file uses but is never given.
 *
 * This exists because of a bug that shipped a broken page: a file used
 * `useEffect` without importing it. A bundler will happily bundle that — the
 * name is only looked up when the line runs — so the build is green and the
 * screen is white.
 *
 * It was once narrower than this — only what a file *called* or *rendered* —
 * and that let one through: `SPECIAL_ROLES.includes(role)` is neither a call
 * on SPECIAL_ROLES nor a component, so nothing looked at it, and the verdict
 * card crashed on a real phone the first time somebody was voted out. It now
 * reports any name a file *reaches for* and was never given.
 *
 * The net is kept honest by the naming conventions rather than by a list of
 * exceptions: it looks at names that are imported things in this codebase —
 * a hook, a component, a class, a constant — and ignores the lowercase local
 * world of loop variables and props.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Everything in a file that is not code.
 *
 * One pass, left to right, because JavaScript cannot be lexed by running
 * replacements one after another: strip strings first and a regular
 * expression containing a quote comes apart; strip regexes first and a
 * string containing a slash does. The first version of this did exactly
 * that and reported `A`, `S` and `Z` as undefined names, which are the
 * insides of `[A-Za-z]` and `[\s\S]`.
 *
 * Comments, strings, template literals and regexes all become blanks, with
 * newlines kept so line numbers still mean something. Prose between JSX tags
 * is left alone here — blanking it needs to know where a tag ends, and every
 * cheap way of guessing that swallowed real code, because `=>` ends in `>`.
 * It is handled where the names are read instead.
 */
export function stripNonCode(source) {
  let out = '';
  let i = 0;
  // Whether a `/` here starts a regex or divides: after a value it divides,
  // after an operator or a keyword it starts one.
  let lastMeaningful = '';

  const blank = (text) => text.replace(/[^\n]/g, ' ');

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }

    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }

    const ch = source[i];

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
      out += ch + blank(source.slice(i + 1, j)) + (source[j] ?? '');
      i = j + 1;
      lastMeaningful = 'x';
      continue;
    }

    // A template literal is text with code in it. The text is blanked and
    // every `${…}` is kept exactly as written, because `cup-${useId()}` is a
    // file calling a hook and blanking it hid a crash from this check.
    if (ch === '`') {
      let j = i + 1;
      out += '`';
      while (j < source.length && source[j] !== '`') {
        if (source[j] === '\\') {
          out += '  ';
          j += 2;
          continue;
        }
        if (source[j] === '$' && source[j + 1] === '{') {
          const from = j;
          let depth = 0;
          j += 1; // the walk counts braces, so it has to start on one
          do {
            if (source[j] === '{') depth += 1;
            else if (source[j] === '}') depth -= 1;
            j += 1;
          } while (j < source.length && depth > 0);
          out += source.slice(from, j);
          continue;
        }
        out += /\n/.test(source[j]) ? '\n' : ' ';
        j += 1;
      }
      out += source[j] ?? '';
      i = j + 1;
      lastMeaningful = 'x';
      continue;
    }

    if (ch === '/' && !/[\w$)\]]/.test(lastMeaningful)) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const c = source[j];
        if (c === '\\') j += 2;
        else if (c === '[') { inClass = true; j += 1; }
        else if (c === ']') { inClass = false; j += 1; }
        else if (c === '/' && !inClass) break;
        else if (c === '\n') break;
        else j += 1;
      }
      if (source[j] === '/') {
        let k = j + 1;
        while (k < source.length && /[gimsuyd]/.test(source[k])) k += 1;
        out += '/' + blank(source.slice(i + 1, k - 1)) + '/';
        i = k;
        lastMeaningful = 'x';
        continue;
      }
    }

    out += ch;
    if (!/\s/.test(ch)) lastMeaningful = ch;
    i += 1;
  }

  return out;
}

/** Everything the file brings into scope: imports, declarations, parameters. */
function bindings(code) {
  const names = new Set();
  const add = (list) => list.forEach((n) => n && names.add(n));

  add(code.match(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)?.map((m) => m.split(/\s+/)[1]) ?? []);
  for (const group of code.matchAll(/^import\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}/gm)) {
    add(group[1].split(',').map((n) => n.trim().split(/\s+as\s+/).pop().trim()));
  }
  add([...code.matchAll(/^import\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
  add([...code.matchAll(/^import\s*\*\s*as\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));

  // destructuring, in a declaration or in a parameter list
  for (const group of code.matchAll(/\{([^{}]*)\}\s*(?:=|=>|\))/g)) {
    add(group[1].split(',').map((n) => n.trim().split(/[:=]/).pop().trim().replace(/^\.\.\./, '')));
  }
  for (const group of code.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    add(group[1].split(',').map((n) => n.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./, '')));
  }
  add([...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)].map((m) => m[1]));
  // array destructuring, in a declaration or a parameter: ([Icon, name]) => …
  for (const group of code.matchAll(/\[([^[\]]*)\]\s*(?:=[^=>]|=>|\))/g)) {
    add(group[1].split(',').map((n) => n.trim().replace(/^\.\.\./, '')));
  }
  add([...code.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  add([...code.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  return names;
}

/** Things a browser or node hands a file without it asking. */
const AMBIENT = new Set([
  'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location',
  'history', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'fetch', 'process', 'globalThis',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Set', 'Map', 'WeakMap',
  'JSON', 'Math', 'Promise', 'Error', 'TypeError', 'RangeError', 'Symbol', 'Intl',
  'RegExp', 'URL', 'URLSearchParams', 'Image', 'Blob', 'Response', 'Request',
  'Headers', 'EventSource', 'AbortController', 'TextEncoder', 'TextDecoder',
  'ResizeObserver', 'Event', 'CustomEvent', 'FileReader', 'CSSRule', 'crypto',
  'performance', 'structuredClone', 'btoa', 'atob', 'isNaN', 'parseInt', 'parseFloat',
  'encodeURIComponent', 'decodeURIComponent', 'Infinity', 'NaN', 'undefined',
  'Buffer', 'Uint8Array', 'ArrayBuffer', 'DataView', 'WeakSet', 'Proxy', 'Reflect',
  'BigInt', 'Function', 'CSS', 'MutationObserver', 'IntersectionObserver',
]);

/**
 * Folders that hold no source, whatever is in them.
 *
 * `dist` is the one that matters. It is the project's own build output —
 * every file in src, bundled into one line — so scanning it meant every
 * check was reading a copy of the code it had just read, in a form it was
 * never written to be read in. For the string checks it was worse than slow:
 * the bundle contains every string table, so a key nothing asks for still
 * appeared, and the dead-key report came back empty however much was dead.
 */
const NOT_SOURCE = new Set(['dist', 'node_modules', '.git', 'coverage', '.vite']);

/** Every .js and .jsx file under a folder, excluding what is not source. */
export function sourceFiles(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (NOT_SOURCE.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

/**
 * What one file calls or renders without being given it.
 *
 * Returns a list of names, empty when the file is fine.
 */
export function unresolvedNames(file) {
  const source = readFileSync(file, 'utf8');
  const clean = stripNonCode(source);
  const have = new Set([...bindings(clean), ...AMBIENT]);
  const code = clean
    // An import names what it wants; a re-export names what it passes on.
    // Neither is the file reaching for something it does not have.
    .replace(/^import[\s\S]*?;\s*$/gm, ' ')
    .replace(/^export\s*(?:\*|\{[^}]*\})\s*from[^;]*;\s*$/gm, ' ')
    // A key in an object literal is a label, not a value: PHASE.LOBBY is
    // declared as `LOBBY: 'lobby'`, and nobody is asking for LOBBY.
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1')
    // `$` is a legal identifier character, so the scan below read the `$` of
    // `${useId()}` as a name and ate the boundary in front of the real one.
    // That hid a crash from this check, so the marker is opened out here.
    .replace(/\$\{/g, ' {');

  // Every name used *as a value*, which is the part that matters and also
  // the part that tells code from prose. A value is followed by something
  // that does something to it — a dot, a bracket, an operator, the end of
  // the expression. `<b>Thanate Amornjiraporn</b>` is a credit, and the
  // giveaway is that each word is followed by another word.
  const used = [...code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)([\s\S]?)/gm)]
    // `<` and `>` are not on this list, even though they are operators: in a
    // .jsx file they are far more often the edge of a tag, and the last word
    // of a line of prose sits right against a closing one.
    .filter(([, , , after]) => after === '' || /[.([)\],;}=?:&|+\-*/!\n]/.test(after))
    .map((m) => m[2]);
  const rendered = [...code.matchAll(/<\/?([A-Z][\w$]*)/g)].map((m) => m[1]);

  // What an import looks like here: a hook, a component or class, or a
  // constant. Lowercase names are the file's own world — and a hook is
  // `use` followed by a capital, or `userAgent` counts as one.
  const imported = (n) => /^use[A-Z]/.test(n) || /^[A-Z]/.test(n);
  const suspects = new Set([...used, ...rendered].filter((n) => imported(n) && !have.has(n)));
  return [...suspects].sort();
}
