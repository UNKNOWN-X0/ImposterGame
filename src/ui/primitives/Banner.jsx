/**
 * Something to tell the reader, and something to tell a screen reader.
 */


export function Banner({ kind = '', children }) {
  if (!children) return null;
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

/** Announces phase changes to a screen reader without showing anything. */
export function Announce({ children }) {
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {children}
    </div>
  );
}

