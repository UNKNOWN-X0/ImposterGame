/**
 * A pinch of markup in a translated string.
 */


/**
 * The one piece of markup a translated string may carry: <b>.
 *
 * Anything else — or a tag that ended up nested because a value was wrapped
 * twice — would otherwise be printed as source, so the leftovers are stripped
 * rather than shown. A player should never read a bold tag.
 */
export function Rich({ text }) {
  const parts = String(text)
    .replace(/<b>(<b>)+/g, '<b>')
    .replace(/(<\/b>)+<\/b>/g, '</b>')
    .split(/(<b>.*?<\/b>)/g)
    .filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('<b>') ? (
          <b key={i}>{part.slice(3, -4)}</b>
        ) : (
          <span key={i}>{part.replace(/<\/?[a-z][^>]*>/gi, '')}</span>
        ),
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Tooltip
 * ------------------------------------------------------------------ */

/**
 * A little ⓘ that explains the trade-off behind a setting.
 *
 * Tap to open rather than hover: most of this game is played on a phone,
 * where hover does not exist. It closes on Escape, on a tap anywhere else,
 * and is tied to its button with aria-describedby so a screen reader gets
 * the explanation rather than just "info".
 */
