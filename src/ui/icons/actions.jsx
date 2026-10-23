/**
 * Things to do and states to be in.
 */

import { useId } from 'react';

import { Icon } from './Icon.jsx';

/* ------------------------------------------------------------------ *
 * Actions and states
 * ------------------------------------------------------------------ */

/**
 * Pass the phone on: an open hand, held up.
 *
 * Four fingers and a thumb, which is what a hand has — an earlier version
 * showed three and looked wrong for a reason that was hard to place. The
 * long path runs from the little finger, around the palm and the thumb, and
 * back up the index finger, so the fingers sit side by side and no stroke is
 * drawn twice. On `anim` it waves from the wrist rather than sliding
 * sideways: a wave is what a hand does.
 */
export const PassIcon = (p) => (
  <Icon {...p}>
    <g className="hand">
      <path d="M11 10.9V5.4a1.4 1.4 0 0 1 2.8 0v4.6" />
      <path d="M13.8 10.7V6a1.4 1.4 0 0 1 2.8 0v4.2" />
      <path d="M16.6 10.9V7.8a1.4 1.4 0 0 1 2.8 0v6a6.3 6.3 0 0 1-6.3 6.3h-1.1a6 6 0 0 1-4.24-1.76l-3.5-3.5a1.6 1.6 0 0 1 2.26-2.26L8.2 15.3V6.6a1.4 1.4 0 0 1 2.8 0v3.6" />
    </g>
  </Icon>
);

/**
 * Watching: an open eye that blinks.
 *
 * The lash line sits closed over the eye and is invisible until the lid comes
 * down, so a blink is a real shut rather than the eye fading out.
 */
export const EyeIcon = (p) => (
  <Icon {...p}>
    <g className="eyes lid">
      <path d="M3 12S6.2 6.2 12 6.2 21 12 21 12s-3.2 5.8-9 5.8S3 12 3 12Z" />
      <circle className="pupils" cx="12" cy="12" r="2.8" />
    </g>
    <path className="eye-lash" d="M4.8 12h14.4" opacity="0" />
  </Icon>
);

/** Calling the word: a bell. On `anim` it rings. */
export const BellIcon = (p) => (
  <Icon {...p}>
    <g className="bell-body">
      <path d="M18 9.6a6 6 0 1 0-12 0c0 5.2-1.8 6.6-1.8 6.6h15.6S18 14.8 18 9.6Z" />
    </g>
    <path className="clapper" d="M10.4 19.6a1.9 1.9 0 0 0 3.2 0" />
  </Icon>
);

/** The last-word gamble: a die. On `anim` it rolls. */
export const DiceIcon = (p) => (
  <Icon {...p}>
    <g className="die">
      <rect x="3.9" y="3.9" width="16.2" height="16.2" rx="4" />
      <g className="pips">
        <path d="M8.6 8.6h.01M15.4 8.6h.01M12 12h.01M8.6 15.4h.01M15.4 15.4h.01" strokeWidth="2.6" />
      </g>
    </g>
  </Icon>
);

/** Caught: a target. On `anim` the rings close in. */
export const TargetIcon = (p) => (
  <Icon {...p}>
    <circle className="ring-out" cx="12" cy="12" r="8.8" />
    <circle className="ring-in" cx="12" cy="12" r="4.9" />
    <path d="M12 12h.01" strokeWidth="2.6" />
  </Icon>
);

/**
 * A wrong call: a shield split by a crack.
 *
 * The crack used to stop short at both ends, which made it a lightning bolt
 * on a shield — the sign for power, not for damage. It now runs the full
 * height and breaks the outline at the top, so the shield reads as failed.
 */
export const BrokenIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3.2 4.6 6.1v6c0 4.4 3.1 7.8 7.4 8.8 4.3-1 7.4-4.4 7.4-8.8v-6L12 3.2Z" />
    <path className="crack" d="M12 3.6 10.8 7.6l2.2 2-1.8 3.6 1.6 2.4-1.2 4.2" />
  </Icon>
);

/** A split vote: a balanced scale. On `anim` it rocks and settles level. */
export const TieIcon = (p) => (
  <Icon {...p}>
    <path d="M12 4.6v15M6.4 19.6h11.2" />
    <g className="beam">
      <path d="M4 9.4h16" />
      <path d="M7 9.4 4.7 14.2a2.4 2.4 0 0 0 4.6 0L7 9.4Z" />
      <path d="M17 9.4l-2.3 4.8a2.4 2.4 0 0 0 4.6 0L17 9.4Z" />
    </g>
  </Icon>
);

/** Waiting on someone. On `anim` it turns over, the way you would turn one. */
export const HourglassIcon = (p) => (
  <Icon {...p}>
    <g className="glass">
      <path d="M5.6 3.4h12.8M5.6 20.6h12.8" />
      <path d="M6.8 3.4c0 4.2 5.2 5.6 5.2 8.6s-5.2 4.4-5.2 8.6" />
      <path d="M17.2 3.4c0 4.2-5.2 5.6-5.2 8.6s5.2 4.4 5.2 8.6" />
    </g>
  </Icon>
);

/** Nothing to see here. The eyes blink; on `anim` the face tilts. */
export const ShrugIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <g className="face">
      <path d="M8.6 14.9c1-.9 2.1-1.3 3.4-1.3s2.4.4 3.4 1.3" />
      <path className="eyes" d="M8.8 9.4h.01M15.2 9.4h.01" strokeWidth="2.4" />
    </g>
  </Icon>
);

/**
 * A win. On `anim` a shine crosses the cup.
 *
 * The clip gets an id of its own per instance — two trophies on one page
 * sharing one id is the kind of thing that works until it does not.
 */
export function TrophyIcon(p) {
  const clip = `cup-${useId()}`;
  return (
    <Icon {...p}>
      <defs>
        <clipPath id={clip}>
          <path d="M7.4 3.6h9.2v5.2a4.6 4.6 0 0 1-9.2 0V3.6Z" />
        </clipPath>
      </defs>
      <path d="M7.4 3.6h9.2v5.2a4.6 4.6 0 0 1-9.2 0V3.6Z" />
      <path d="M7.4 5.2H4.9a2.7 2.7 0 0 0 2.7 4.4" />
      <path d="M16.6 5.2h2.5a2.7 2.7 0 0 1-2.7 4.4" />
      <path d="M12 13.4v3.2M8.4 20.4h7.2M9.6 16.6h4.8v3.8H9.6z" />
      <g clipPath={`url(#${clip})`}>
        <path className="shine" d="M2 14 10 2" strokeWidth="2.6" opacity="0" />
      </g>
    </Icon>
  );
}

/** Done. Draws itself on wherever it marks something finished. */
export const CheckIcon = (p) => (
  <Icon {...p}>
    <path className="draw-on" d="m4.6 12.6 4.8 4.8L19.4 6.8" pathLength="1" />
  </Icon>
);

/**
 * Appearance: a disc half in shadow.
 *
 * The one drawing everybody already reads as light-and-dark. On `anim` the
 * shadow slides across, which is the switch itself.
 */
export const ContrastIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path className="shade" d="M12 3.2a8.8 8.8 0 0 0 0 17.6Z" fill="currentColor" stroke="none" />
  </Icon>
);

/** Add something. */
export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5.2v13.6M5.2 12h13.6" />
  </Icon>
);

/** Edit what is already there. */
export const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="M4.4 19.6h4l10-10a2.83 2.83 0 0 0-4-4l-10 10v4Z" />
    <path d="m14.8 6.8 2.4 2.4" />
  </Icon>
);

export const ChevronLeftIcon = (p) => (
  <Icon {...p}>
    <path d="M14.8 5.2 8 12l6.8 6.8" />
  </Icon>
);

/** Language. On `anim` the meridian sweeps, so the globe turns. */
export const GlobeIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M3.4 12h17.2" />
    <path className="meridian" d="M12 3.2c2.3 2.4 3.5 5.4 3.5 8.8s-1.2 6.4-3.5 8.8c-2.3-2.4-3.5-5.4-3.5-8.8S9.7 5.6 12 3.2Z" />
  </Icon>
);

/** Copy. On `anim` the top sheet lifts, which is the whole gesture. */
export const CopyIcon = (p) => (
  <Icon {...p}>
    <path d="M15 9V6.6A2.6 2.6 0 0 0 12.4 4H6.6A2.6 2.6 0 0 0 4 6.6v5.8A2.6 2.6 0 0 0 6.6 15H9" />
    <rect className="sheet" x="9" y="9" width="11" height="11" rx="2.6" />
  </Icon>
);

/** One phone, passed around. */
export const PhoneIcon = (p) => (
  <Icon {...p}>
    <rect x="6.2" y="3.2" width="11.6" height="17.6" rx="3" />
    <path d="M10.6 17.8h2.8" />
  </Icon>
);

/** A phone each, over the same wifi. On `anim` the arcs go out in turn. */
export const WifiIcon = (p) => (
  <Icon {...p}>
    <path className="arc-3" d="M3.2 8.8a13.6 13.6 0 0 1 17.6 0" />
    <path className="arc-2" d="M6.4 12.1a8.9 8.9 0 0 1 11.2 0" />
    <path className="arc-1" d="M9.4 15.4a4.4 4.4 0 0 1 5.2 0" />
    <path d="M12 18.6h.01" strokeWidth="2.4" />
  </Icon>
);
