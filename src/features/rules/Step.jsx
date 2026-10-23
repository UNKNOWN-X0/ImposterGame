/**
 * One numbered step of the rules.
 *
 * Shared by the rules screen and the card shown on a first visit, so there
 * is one set of four steps rather than two that can drift apart. It is its
 * own file so that the first-run card does not drag the whole rules screen
 * into the first download with it.
 */

export function Step({ n, title, children }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
      <span className="avatar" style={{ background: 'var(--accent)' }} aria-hidden="true">
        {n}
      </span>
      <div className="grow">
        <b>{title}</b>
        <p className="subtitle" style={{ fontSize: 15 }}>
          {children}
        </p>
      </div>
    </div>
  );
}
