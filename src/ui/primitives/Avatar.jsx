/**
 * A player, in one letter.
 */

import { useMemo } from 'react';

const AVATAR_COLOURS = [
  '#f5b642', '#7dd3fc', '#c4b5fd', '#fda4af',
  '#86efac', '#fcd34d', '#f0abfc', '#5eead4',
];

export function Avatar({ name, dim }) {
  const colour = useMemo(() => {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
  }, [name]);
  return (
    <span
      className={`avatar${dim ? ' dim' : ''}`}
      style={{ background: colour }}
      aria-hidden="true"
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}
