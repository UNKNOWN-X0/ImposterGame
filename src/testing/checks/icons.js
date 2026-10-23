/**
 * The icons a phone looks for when the game is saved to a home screen.
 *
 * This exists because for several versions there were none. The game had one
 * SVG favicon, which iOS ignores entirely, so anybody who added it to their
 * home screen got a blank square with a letter in it — and nothing anywhere
 * said so, because a missing icon is not an error on any screen a developer
 * ever looks at.
 *
 * Reading a PNG header is enough to check the part that goes wrong: a file
 * that is there, is really a PNG, and is really the size it claims to be.
 * An icon declared as 512 and shipped as 48 looks fine in a listing and
 * terrible on a phone.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What a PNG says it is, read from its header. Null if it is not one. */
export function pngSize(file) {
  const head = readFileSync(file).subarray(0, 33);
  if (!head.subarray(0, 8).equals(PNG_MAGIC)) return null;
  // IHDR is the first chunk: 8 magic + 4 length + 4 type, then width, height.
  if (head.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

/** Every file index.html points at with a link or meta tag. */
export function linkedFiles(html) {
  const out = [];
  for (const [, rel, href] of html.matchAll(
    /<link\s+rel="([^"]+)"[^>]*href="([^"]+)"/g,
  )) {
    out.push({ rel, href });
  }
  return out;
}

/** The icons a manifest promises, and what it promises about them. */
export function manifestIcons(manifest) {
  return (manifest.icons ?? []).map((icon) => ({
    src: icon.src,
    purpose: icon.purpose ?? 'any',
    type: icon.type,
    // "any" is a legal size for an SVG and a lie for a PNG.
    declared: icon.sizes === 'any' ? null : icon.sizes.split('x').map(Number),
  }));
}

/** Where a path in a tag or a manifest actually lives on disk. */
export const inPublic = (root, href) => path.join(root, 'public', href.replace(/^\//, ''));

/** Files named but not shipped. */
export function missing(root, hrefs) {
  return hrefs.filter((href) => !existsSync(inPublic(root, href)));
}
