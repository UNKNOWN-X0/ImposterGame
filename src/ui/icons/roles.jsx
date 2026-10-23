/**
 * What is on a card: the two sides, the optional roles, and the back.
 */

import { Icon } from './Icon.jsx';

/* ------------------------------------------------------------------ *
 * Roles and the card
 *
 * All of these are drawn inside a 20×20 live area on the 24 grid, with the
 * outer 2 left clear, and sized by keyline rather than by bounding box: a
 * circle may run the full 20 because a circle reads smaller than a square of
 * the same width, a square stops around 18, and an upright shape is about
 * 16 across by 20 tall. Stroke is 1.8 everywhere with round caps and joins,
 * and no gap between two strokes is narrower than the stroke itself.
 * ------------------------------------------------------------------ */

/**
 * Crew: a shield with a tick. Steady, on-side.
 *
 * The tick carries `pathLength="1"`, so a dash the length of the whole path
 * can stroke it on from nothing when a card turns over.
 */
export const CrewIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3.2 4.6 6.1v6c0 4.4 3.1 7.8 7.4 8.8 4.3-1 7.4-4.4 7.4-8.8v-6L12 3.2Z" />
    <path className="draw-on" d="m8.9 11.9 2.2 2.2 4-4.2" pathLength="1" />
  </Icon>
);

/**
 * Imposter: a domino mask, with eyes behind it.
 *
 * They blink, and on `anim` they glance left and right — the tell you are
 * watching for at the table, drawn small.
 */
export const ImposterIcon = (p) => (
  <Icon {...p}>
    <path d="M3.2 9.6c2.8-1 5.7-1.5 8.8-1.5s6 .5 8.8 1.5c.4 3-.4 5.1-2.3 6.2-2 1.3-3.8-.1-4.7-1.4-.5-.8-1.1-1.2-1.8-1.2s-1.3.4-1.8 1.2c-.9 1.3-2.7 2.7-4.7 1.4-1.9-1.1-2.7-3.2-2.3-6.2Z" />
    <g className="eyes">
      <g className="pupils">
        <circle cx="8.1" cy="11.5" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="15.9" cy="11.5" r="1.15" fill="currentColor" stroke="none" />
      </g>
    </g>
  </Icon>
);

/**
 * The detective: a magnifier.
 *
 * On `anim` it sweeps a little, the way you look for something rather than
 * at it.
 */
export const DetectiveIcon = (p) => (
  <Icon {...p}>
    <g className="lens">
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M8.2 8.6a3.4 3.4 0 0 1 2.4-1" opacity="0.5" />
    </g>
    <path d="m15.3 15.3 5 5" />
  </Icon>
);

/**
 * The jester: a cap with two bells.
 *
 * On `anim` the whole cap tips side to side and the bells swing after it,
 * which is the role in one movement — they are playing the fool on purpose.
 */
export const JesterIcon = (p) => (
  <Icon {...p}>
    <g className="cap">
      <path d="M6.4 14.6c-.8-3 .4-6.2 2.6-7.6" />
      <path d="M17.6 14.6c.8-3-.4-6.2-2.6-7.6" />
      <path d="M12 5.2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M6.4 14.6h11.2a1.6 1.6 0 0 1 0 3.2H6.4a1.6 1.6 0 0 1 0-3.2Z" />
    </g>
    <g className="bells">
      <path d="M5.4 12.4h.01M18.6 12.4h.01" strokeWidth="2.6" />
    </g>
  </Icon>
);

/**
 * The sidekick: two figures, one a step behind the other.
 *
 * On `anim` the one behind edges closer, which is what a sidekick does.
 */
export const SidekickIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="7.6" r="3.2" />
    <path d="M3.6 20.4a5.4 5.4 0 0 1 10.8 0" />
    <g className="shadow-figure">
      <path d="M15.6 5.2a3.2 3.2 0 0 1 0 4.8" opacity="0.65" />
      <path d="M16.4 15.6a5.4 5.4 0 0 1 4 4.8" opacity="0.65" />
    </g>
  </Icon>
);

/** Keeping score: a column chart, tallest first. */
export const ScoreIcon = (p) => (
  <Icon {...p}>
    <path d="M4.6 20.2h14.8" />
    <g className="bars">
      <path d="M7.4 20.2v-5.4" />
      <path d="M12 20.2v-9.4" />
      <path d="M16.6 20.2v-7" />
    </g>
  </Icon>
);

/** Blind mode: a card with a question on it. Gives nothing away. */
export const UnknownIcon = (p) => (
  <Icon {...p}>
    <rect x="4.6" y="2.8" width="14.8" height="18.4" rx="3" />
    <g className="question">
      <path d="M9.8 9.4c.2-1.3 1.1-2.1 2.4-2.1 1.3 0 2.3.9 2.3 2.1 0 1.8-2.2 1.9-2.2 3.5" />
      <path d="M12.2 16.3h.01" strokeWidth="2.4" />
    </g>
  </Icon>
);

/**
 * A hint: a bulb.
 *
 * It was a card with lines on it, which was the card-back icon with one line
 * fewer — two different things that looked the same. A bulb is the one
 * drawing everybody already reads as "here is a clue", and it can light up.
 */
export const HintIcon = (p) => (
  <Icon {...p}>
    <g className="bulb">
      <path d="M12 3.4a5.7 5.7 0 0 1 3.4 10.3c-.6.4-.9 1-.9 1.7v.4h-5v-.4c0-.7-.3-1.3-.9-1.7A5.7 5.7 0 0 1 12 3.4Z" />
      <path d="M9.9 18.4h4.2M10.8 20.8h2.4" />
    </g>
    <g className="rays">
      <path d="M19.6 5.6l-1.1.8M4.4 5.6l1.1.8M18.9 11.4h1.4M3.7 11.4h1.4" />
    </g>
  </Icon>
);

/** Face-down card, used on the shield before a reveal. */
export const CardBackIcon = (p) => (
  <Icon {...p}>
    <rect x="4.6" y="2.8" width="14.8" height="18.4" rx="3" />
    <g className="lines" opacity="0.55">
      <path d="M8.4 7.6h7.2" />
      <path d="M8.4 12h7.2" />
      <path d="M8.4 16.4h3.6" />
    </g>
  </Icon>
);
