/**
 * Redraw the home-screen icons from the artwork in public/.
 *
 * Run it with:  npm run icons
 *
 * The PNGs a phone needs are made from `public/icon.svg` and
 * `public/icon-maskable.svg`, which are the real brand mark with its colours
 * written out. Edit those; run this; the PNGs follow. They are checked in
 * rather than built at deploy time, because a home-screen icon is not worth
 * a build step on somebody else's machine — but that means they can go stale
 * if the mark changes and this is not run, so the shapes and sizes are
 * checked by `npm test`.
 *
 * They are rendered in a browser rather than by an image library so they look
 * exactly as the same mark looks in the game: the same engine draws both.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');

/** [source artwork, file to write, pixels square, why it exists] */
const ICONS = [
  ['icon.svg', 'apple-touch-icon.png', 180, 'what iOS puts on a home screen'],
  ['icon.svg', 'icon-192.png', 192, 'Android, and anything reading the manifest'],
  ['icon.svg', 'icon-512.png', 512, 'splash screens, and anywhere large'],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512, 'Android, cropped to the phone’s own shape'],
  ['icon.svg', 'favicon-32.png', 32, 'browsers that will not take an SVG'],
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Redrawing the icons needs a browser, which the game itself does not:\n' +
      '  npm install --no-save playwright && npx playwright install chromium\n' +
      'The icons already in public/ are fine until the mark changes.',
  );
  process.exit(1);
}

for (const [source] of ICONS) {
  if (!existsSync(path.join(PUBLIC, source))) {
    console.error(`Missing artwork: public/${source}`);
    process.exit(1);
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ['--no-sandbox'],
});

for (const [source, file, size, why] of ICONS) {
  const svg = readFileSync(path.join(PUBLIC, source), 'utf8');
  const ctx = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0}` +
      `svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.waitForTimeout(120);
  writeFileSync(path.join(PUBLIC, file), await page.screenshot());
  console.log(`  ${file.padEnd(24)} ${String(size).padStart(3)}²  ${why}`);
  await ctx.close();
}

await browser.close();
console.log('\nRedrawn. `npm test` checks they are the sizes the manifest promises.');
