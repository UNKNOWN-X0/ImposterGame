/**
 * The mark, and the only icon that is the game rather than in it.
 */

/* ------------------------------------------------------------------ *
 * Brand
 * ------------------------------------------------------------------ */

/**
 * The mark: a pair of spectacles under a hat brim, with a glint that sweeps
 * across the lenses. The eyes blink on a long, irregular cycle so it reads as
 * alive rather than as a loading spinner.
 */
export function BrandMark({ size = 34, animated = true }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`brandmark${animated ? ' alive' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="bm-glint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="bm-lenses">
          <circle cx="16" cy="28" r="8" />
          <circle cx="32" cy="28" r="8" />
        </clipPath>
      </defs>

      {/* crown, band and brim — a fedora, read at a glance */}
      <path
        d="M13 16.5V11c0-3.4 4.4-5.4 11-5.4s11 2 11 5.4v5.5"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M13 16.4h22" stroke="currentColor" strokeWidth="2.6" opacity="0.45" />
      <path
        d="M5 18.4h38"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />

      {/* lenses */}
      <circle cx="16" cy="28" r="8" fill="currentColor" />
      <circle cx="32" cy="28" r="8" fill="currentColor" />
      <path d="M24 26h0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

      {/* pupils — these blink */}
      <g className="bm-eyes">
        <circle cx="16" cy="28" r="3" className="bm-pupil" />
        <circle cx="32" cy="28" r="3" className="bm-pupil" />
      </g>

      {/* glint sweeping across both lenses */}
      <g clipPath="url(#bm-lenses)">
        <rect className="bm-glint" x="-24" y="18" width="14" height="20" fill="url(#bm-glint)" />
      </g>
    </svg>
  );
}
