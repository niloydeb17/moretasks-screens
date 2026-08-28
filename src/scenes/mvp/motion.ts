/**
 * "Most Valuable Player" motion — Figma node 1:9369.
 *
 * Read from the design's own keyframe tracks (`get_motion_context`), which
 * report one looping cohort of 49237.35ms. Figma expresses each track's
 * keyframe positions as fractions of that whole, so every time below is
 * `fraction x DURATION_SECONDS` — kept as the arithmetic rather than as a
 * baked constant, so the two can never drift apart.
 *
 * Nearly everything lands within the first ~1.2s; the remaining ~48s is the
 * starburst's slow single revolution. That long tail is the design, not an
 * oversight — this is an ambient office-screen loop.
 */

import { cubicBezier } from '@/lib/cubicBezier';

/** The cohort length Figma reports for this frame. */
export const DURATION_SECONDS = 49.23735;

/** Fraction of the timeline -> seconds. */
const at = (fraction: number) => fraction * DURATION_SECONDS;

/** The easing on every entrance track in this design — Figma's expo-out. */
export const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

/** Ease-in-out, used only by the starburst's opening spin. */
export const EASE_IN_OUT = cubicBezier(0.5, 0, 0.5, 1);

/**
 * The starburst's scale easing, taken verbatim from Figma's export.
 *
 * This is a damped spring already solved for normalised progress, so it is used
 * as-is rather than re-derived: re-deriving would mean recovering mass/stiffness
 * /damping from these coefficients and then re-solving the same ODE, which can
 * only lose precision.
 */
export const SPRING_SCALE = (t: number): number =>
  1 - Math.exp(-t * 7.6657) * (Math.cos(t * 6.7605) + 1.1339 * Math.sin(t * 6.7605));

/**
 * The starburst: a fast spin-and-swell in, then one slow revolution.
 *
 * `rotate` is absolute (not a delta): it starts at 343.953deg, snaps to the rest
 * pose of -12.047deg, then travels a further +360deg over the rest of the loop —
 * which lands back on the same visual angle, so the loop is seamless.
 */
export const STARBURST_MOTION = {
  rotate: {
    from: 343.953,
    rest: -12.047,
    end: 347.953,
    spinEndsAt: at(0.0091),
  },
  scale: {
    from: 0.1,
    startsAt: at(0.0091),
    endsAt: at(0.0204),
  },
} as const;

/** The portrait slides up into its frame — Figma's fastest track, ~0.14s. */
export const PORTRAIT_MOTION = {
  fromY: 946,
  startsAt: at(0.0028),
  endsAt: at(0.0057),
} as const;

/** When the last entrance track finishes — everything is at rest after this. */
export const ENTRANCE_ENDS_AT = at(0.0234);

/**
 * Shortest sensible slot for one person: the entrance plus a couple of seconds
 * to actually read the name. Only reached with a very long list; below that the
 * designed loop length divides evenly and nothing is clamped.
 */
const MIN_SEGMENT_SECONDS = ENTRANCE_ENDS_AT + 2;

/** This rig has no more slots than the ring behind it has blades to show. */
export const MAX_PEOPLE = 16;

/**
 * How long each person holds the screen.
 *
 * Figma only ever describes ONE awardee — there is no multi-person prototype for
 * this frame the way the birthday carousel has one — so this is a deliberate
 * extension rather than extracted design. It divides the designed loop between
 * however many people share the award, which keeps two properties that matter:
 * a single awardee reproduces the design's own 49.237s exactly, and the
 * starburst still completes exactly one revolution per loop, so the loop point
 * stays seamless at any count.
 */
export function segmentSeconds(count: number): number {
  const n = Math.max(1, Math.min(count, MAX_PEOPLE));
  return Math.max(MIN_SEGMENT_SECONDS, DURATION_SECONDS / n);
}

/** Total run time for `count` awardees. */
export function totalSeconds(count: number): number {
  const n = Math.max(1, Math.min(count, MAX_PEOPLE));
  return segmentSeconds(n) * n;
}

/** How long a departing awardee takes to fade out before the next arrives. */
export const HANDOFF_SECONDS = 0.4;

export interface EntranceTrack {
  /** Figma node id, for tracing a value back to the document. */
  id: string;
  /** `data-motion` value of the element it drives. */
  target: string;
  /** When the track leaves its held opening value. */
  delay: number;
  /** Opacity and transform finish at different times on these tracks. */
  fadeDuration: number;
  moveDuration: number;
  /** The value the element animates *from*; the design's rest state is the end. */
  from: { x?: number; y?: number; scale?: number };
}

/**
 * The entrance tracks, in the order they fire.
 *
 * Every one holds at its opening value, eases to the rest pose, then holds for
 * the remaining ~48s — which is why these collapse to a delay plus a duration
 * rather than needing all four of Figma's keyframes spelled out.
 */
export const ENTRANCES: readonly EntranceTrack[] = [
  {
    id: '1:9384',
    target: 'trophy-row',
    delay: at(0.0071),
    fadeDuration: at(0.0132) - at(0.0071),
    moveDuration: at(0.0173) - at(0.0071),
    from: { y: -40 },
  },
  {
    id: '1:9389',
    target: 'eyebrow',
    delay: at(0.0091),
    fadeDuration: at(0.0146) - at(0.0091),
    moveDuration: at(0.0183) - at(0.0091),
    from: { y: 30 },
  },
  {
    id: '1:9394',
    target: 'name',
    delay: at(0.0102),
    fadeDuration: at(0.0169) - at(0.0102),
    moveDuration: at(0.0213) - at(0.0102),
    from: { y: 50 },
  },
  {
    id: '1:9391',
    target: 'laurel-left',
    delay: at(0.0112),
    fadeDuration: at(0.0173) - at(0.0112),
    moveDuration: at(0.0213) - at(0.0112),
    from: { x: -60 },
  },
  {
    id: '1:9407',
    target: 'laurel-right',
    delay: at(0.0112),
    fadeDuration: at(0.0173) - at(0.0112),
    moveDuration: at(0.0213) - at(0.0112),
    from: { x: 60 },
  },
  {
    id: '1:9399',
    target: 'divider',
    delay: at(0.0122),
    fadeDuration: at(0.0168) - at(0.0122),
    moveDuration: at(0.0213) - at(0.0122),
    from: { scale: 0.5 },
  },
  {
    id: '1:9403',
    target: 'role',
    delay: at(0.0132),
    fadeDuration: at(0.0193) - at(0.0132),
    moveDuration: at(0.0234) - at(0.0132),
    from: { y: 40 },
  },
];
