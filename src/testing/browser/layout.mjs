/**
 * What each screen looked like, as something a diff can read.
 *
 * The plan was pixel baselines: a PNG per screen, compared on every run. A
 * PNG is the clearest thing for a person to look at and the worst thing to
 * commit, because it is not really a picture of the layout — it is a picture
 * of the layout *as rendered by one machine's fonts*. The same code on a
 * different computer produces a different file in every pixel, so the check
 * would fail for everybody except whoever generated it, and a check that
 * cries wolf is a check people delete.
 *
 * So both: a PNG is written every run, for a person to open; and this, which
 * is what is actually compared. It records where every laid-out element
 * ended up, rounded, as text — which diffs line by line, costs a few kB
 * instead of a megabyte, and says "the vote grid moved 40px down" in words.
 *
 * Fonts still move things, so a baseline records the browser and the
 * viewport it was taken with. A run that does not match skips rather than
 * fails: the comparison is meaningful in CI and on the machine that wrote
 * it, and quiet everywhere else.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(here, 'shots');
const LAYOUTS = path.join(here, 'layouts');

/** Rounded, because sub-pixel noise is not a layout change. */
const GRID = 2;

/**
 * Where everything on this screen ended up.
 *
 * Two things had to be held still first, and both produced false alarms on
 * the very first run. The page is measured with motion switched off, because
 * the drifting backdrop and the turning globe are at a different point in
 * their cycle every run — the first baseline reported the backdrop as having
 * moved 6px, which it had, and would again, for ever. And positions are
 * taken relative to the document rather than the window, because a screen
 * that happens to be scrolled reports everything shifted by however far.
 */
async function measure(page) {
  // The gate from motion.css: everything that moves is behind it, so this
  // stops all of it at once.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const lines = await page.evaluate((grid) => {
    // Back to the top first. Adding the scroll offset below is what makes a
    // position below the fold mean the same thing twice — but a `fixed`
    // element does not move with the scroll, so on a screen that happened to
    // be scrolled a different amount, the backdrop appeared to have drifted
    // 20px. At the top, both kinds agree.
    window.scrollTo(0, 0);
    const round = (n) => Math.round(n / grid) * grid;
    const out = [];
    for (const el of document.querySelectorAll('[class]')) {
      const rect = el.getBoundingClientRect();
      const box = {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
      if (box.width === 0 && box.height === 0) continue;
      const classes = String(el.className.baseVal ?? el.className)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join('.');
      if (!classes) continue;
      out.push(
        `${el.tagName.toLowerCase()}.${classes} @ ${round(box.x)},${round(box.y)} ` +
          `${round(box.width)}×${round(box.height)}`,
      );
    }
    return out;
  }, GRID);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return lines;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Take a picture and a measurement of whatever is on screen.
 *
 * Returns null when everything matches or there is nothing to match against,
 * and a sentence when the layout has moved.
 */
export async function snapshot(page, name, { update = false, browser } = {}) {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(LAYOUTS, { recursive: true });
  const id = slug(name);

  await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });

  const viewport = page.viewportSize();
  const stamp = `# ${browser ?? 'unknown'} ${viewport.width}×${viewport.height}`;
  const lines = await measure(page);
  const file = path.join(LAYOUTS, `${id}.txt`);
  const now = [stamp, ...lines].join('\n') + '\n';

  if (update || !existsSync(file)) {
    writeFileSync(file, now);
    return null;
  }

  const was = readFileSync(file, 'utf8').split('\n');
  if (was[0] !== stamp) {
    // A different browser or a different window: the comparison would be
    // about fonts rather than about the code.
    return null;
  }

  const old = was.slice(1).filter(Boolean);
  if (old.join('\n') === lines.join('\n')) return null;

  const added = lines.filter((l) => !old.includes(l));
  const gone = old.filter((l) => !lines.includes(l));
  const detail = [...gone.slice(0, 3).map((l) => `  was  ${l}`), ...added.slice(0, 3).map((l) => `  now  ${l}`)];
  return (
    `${name}: ${gone.length} line(s) changed, ${added.length} new\n${detail.join('\n')}\n` +
    `  (npm run screens -- --update to accept, after looking at ` +
    `src/testing/browser/shots/${id}.png)`
  );
}
