/**
 * Pieces that are mostly movement: the hold ring, the confetti, the
 * backdrop that drifts behind everything.
 */

/* ------------------------------------------------------------------ *
 * Pieces that move
 * ------------------------------------------------------------------ */

/**
 * The hold-to-open progress ring.
 *
 * A ring closing around the card reads as "keep going" far better than a bar
 * filling at the bottom did — it sits where the thumb already is and you can
 * see how much is left without looking away from the card.
 */
export function HoldRing({ progress = 0, size = 76 }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      className="hold-ring"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="36" cy="36" r={r} className="hold-ring-track" />
      <circle
        cx="36"
        cy="36"
        r={r}
        className="hold-ring-fill"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
    </svg>
  );
}

/**
 * A burst of confetti for a crew win.
 *
 * Twelve pieces on fixed trajectories rather than a physics loop: it plays
 * once, costs nothing, and cannot end up still animating behind the next
 * screen. `prefers-reduced-motion` removes it entirely.
 */
export function Confetti() {
  const pieces = [
    { x: 8, d: 0, c: 'var(--accent)', r: -24 },
    { x: 18, d: 0.08, c: 'var(--crew)', r: 40 },
    { x: 27, d: 0.16, c: '#7dd3fc', r: 12 },
    { x: 36, d: 0.04, c: 'var(--accent)', r: -52 },
    { x: 45, d: 0.2, c: '#f0abfc', r: 28 },
    { x: 54, d: 0.12, c: 'var(--crew)', r: -16 },
    { x: 63, d: 0.24, c: '#7dd3fc', r: 48 },
    { x: 72, d: 0.06, c: 'var(--accent)', r: -36 },
    { x: 81, d: 0.18, c: '#f0abfc', r: 20 },
    { x: 90, d: 0.1, c: 'var(--crew)', r: -44 },
    { x: 33, d: 0.28, c: 'var(--accent)', r: 56 },
    { x: 66, d: 0.32, c: '#7dd3fc', r: -28 },
  ];
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.x}%`,
            background: p.c,
            animationDelay: `${p.d}s`,
            '--spin': `${p.r}deg`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The drifting backdrop.
 *
 * Two large, very soft blobs moving slowly behind everything. It is there to
 * stop a long dark page feeling flat; it is fixed, non-interactive and heavily
 * blurred, so it never competes with the content on top of it.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="bd-a" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bd-b" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#f5b642" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f5b642" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="bd-one" cx="110" cy="90" r="150" fill="url(#bd-a)" />
        <circle className="bd-two" cx="300" cy="300" r="170" fill="url(#bd-b)" />
      </svg>
    </div>
  );
}
