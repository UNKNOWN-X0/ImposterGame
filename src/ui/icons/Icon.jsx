/**
 * The icon set.
 *
 * Every one is inline SVG drawn on a 24×24 grid and painted with
 * `currentColor`, so an icon takes the colour of whatever it sits in and
 * scales without going fuzzy. This replaces the emoji the interface used to
 * lean on: emoji render differently on every phone — a different face, a
 * different weight, sometimes a different meaning — which is fine in a message
 * and wrong in a product.
 *
 * Icons are decorative here. Every one is `aria-hidden`, and the text beside
 * it carries the meaning.
 */

import { useId } from 'react';

export const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

/**
 * `anim` turns on that icon's own motion — the bell rings, the hand waves,
 * the bulb lights. It is off by default: an icon that moves on every screen
 * it appears on stops meaning anything. Blinking eyes are the exception and
 * run always, because a face that never blinks reads as a diagram.
 */
export function Icon({ size = 24, children, className = '', anim = false, ...rest }) {
  return (
    <svg
      {...base}
      width={size}
      height={size}
      className={`icon${anim ? ' anim' : ''}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </svg>
  );
}
