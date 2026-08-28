/**
 * The MVP card's optional opening — Figma component 34:6268 ("Component 2") in
 * file Yje5sXQV7QUDigZx08fs9A, with the intro clip itself at 31:6210.
 *
 * That component is a four-state storyboard of one sequence:
 *
 *   Frame 291  the intro clip, full bleed
 *   Frame 288  black plate, a small white diamond low on the canvas
 *   Frame 289  black plate, the same diamond grown past every edge
 *   Frame 292  the MVP card — verified to be the card this project already
 *              renders, not a revision of it (33px eyebrow #bdc176, 174px name
 *              #c5c67c to #007b75, 60px role, 213x4 rule, portrait 941x919.195
 *              at 69.5/1024.711 all match `./geometry` exactly)
 *
 * So this module adds only what is genuinely new: the clip, and the diamond wipe
 * that hands off to the card. The card is untouched.
 *
 * WHAT FIGMA DOES AND DOES NOT STATE. The two diamond states are exact, read off
 * the component's own variants. The TIMING is not: `get_motion_context` returns
 * `motionSummary: null` and `timelineDurationMs: null` for the component and for
 * every one of its variants, because the sequencing lives in the file's
 * prototype reactions rather than on a timeline, and those are not exposed. The
 * clip's own length is measured from the file. `WIPE_SECONDS` is therefore a
 * choice, flagged as one below.
 */

import { cubicBezier } from '@/lib/cubicBezier';

const ASSETS = '/assets/mvp';

/**
 * The opening clip.
 *
 * `seconds` is counted off the file — 367 frames at 60fps — rather than taken
 * from the container's rounded 6.12, because the wipe starts where this ends and
 * a hundredth of a second of rounding there is a visible black flash.
 */
export const INTRO_VIDEO = {
  src: `${ASSETS}/intro.mp4`,
  frames: 367,
  fps: 60,
  seconds: 367 / 60,
} as const;

/**
 * The diamond wipe.
 *
 * Figma draws it as a square turned -45 degrees, and gives two states: a 449px
 * square inside a 634.982px box at y 1197.93, then a 3133px square inside a
 * 4430.731px box at y -699.95. Two things fall out of those numbers, and both
 * are why this is expressed as a scale about a point rather than as two boxes:
 *
 *   - 449 * sqrt(2) = 635.0 and 3133 * sqrt(2) = 4430.7, so each box is exactly
 *     the turned square's bounding box. The box is a consequence, not a value to
 *     reproduce.
 *   - both boxes centre on y 1515.42 (1197.93 + 317.491, and -699.95 +
 *     2215.366, agreeing to within 0.006px). The diamond never moves. It only
 *     grows, about a fixed point below the canvas's middle.
 *
 * The final size is not arbitrary either: from that centre, the farthest canvas
 * corner is |540| + |1515.42| = 2055.4 away in the diamond's own metric, and the
 * grown diamond's half-diagonal is 2215.4 — so it covers the frame with a little
 * to spare, which is what makes the handoff to the card's white plate seamless.
 */
export const WIPE = {
  /** The fixed point both Figma states share. */
  centre: { x: 540, y: 1515.42 },
  /** Side lengths of the turned square, start and end. */
  fromSize: 449,
  toSize: 3133,
  rotation: -45,
  /** Frames 288 and 289 are both `bg-black`; the clip is gone by then. */
  plate: '#000000',
  fill: '#ffffff',
} as const;

/**
 * How long the diamond takes to cover the frame.
 *
 * NOT from Figma — see the note at the top of this file. This is the one
 * invented number here, so it is the one knob: at 0.6s the wipe reads as a
 * deliberate transition rather than a cut, and it sits in the same range as the
 * card's own entrance (whose tracks finish at ~1.15s).
 */
export const WIPE_SECONDS = 0.6;

/**
 * The wipe's easing: Figma's Smart Animate default, "Ease Out".
 *
 * The file states no curve, so the tool's own default for an unspecified
 * prototype transition is the closest thing to a stated value. It also happens
 * to be the only kind of curve that works here, which is worth recording. The
 * diamond covers the frame at side 2907 — 91.6% of the way along the ramp from
 * 449 to 3133 — so everything after that point is a plain white screen. The
 * card's own expo-out reaches 91.6% at about t=0.17, which would spend five
 * sixths of the wipe on a motionless white frame; this curve gets there at
 * about t=0.65, so the diamond is still visibly moving for most of the beat and
 * the white lands as a brief flash into the card rather than a stall.
 */
const WIPE_EASE = cubicBezier(0, 0, 0.58, 1);

/**
 * How many composition frames the clip occupies.
 *
 * Floored on purpose. The frame seeker aims at the MIDDLE of a frame — see
 * `seekVideoToFrame` — and wraps with `% duration`, so a count that let the last
 * frame land at or past the clip's end would wrap it back to the clip's first
 * frame and flash the opening image right before the wipe. Flooring guarantees
 * the last sampled position is strictly inside the clip.
 */
export function videoFrames(fps: number): number {
  return Math.floor(INTRO_VIDEO.seconds * fps);
}

export function wipeFrames(fps: number): number {
  return Math.round(WIPE_SECONDS * fps);
}

/** Frames before the card begins: the clip, then the wipe. */
export function introFrames(fps: number): number {
  return videoFrames(fps) + wipeFrames(fps);
}

/** Seconds before the card begins, for sizing the composition. */
export function introSeconds(fps: number): number {
  return introFrames(fps) / fps;
}

/**
 * The diamond's side length at a frame, or `null` outside the wipe.
 *
 * Computed straight from the frame rather than driven by a GSAP timeline, which
 * is deliberate: the card's timeline runs on its own clock (it is seeked to
 * `frame - introFrames`, so that it opens as the wipe finishes), and one
 * timeline cannot carry two time bases. A pure function of `frame` is every bit
 * as reproducible as a seeked tween — which is the property that actually
 * matters here — and it is a great deal easier to follow than a second timeline
 * would be.
 */
export function wipeSize(frame: number, fps: number): number | null {
  const start = videoFrames(fps);
  const span = wipeFrames(fps);
  if (frame < start || frame >= start + span) return null;
  const t = WIPE_EASE((frame - start) / span);
  return WIPE.fromSize + (WIPE.toSize - WIPE.fromSize) * t;
}
