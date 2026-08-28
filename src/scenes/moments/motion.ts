/**
 * "MoreTasks Highlights" (Moments) motion — Figma node 457:211128.
 *
 * Read from the design's own keyframe tracks (`get_motion_context`), which
 * report one looping cohort of 21477ms driving five nested frames.
 *
 * Those five frames are a camera rig: the innermost holds the wall and carries
 * the pull-back, and each wrapper outside it carries one pan-and-zoom onto the
 * next tile. Because each wrapper returns to scale 1 when its turn ends, only
 * ever one is lifted at a time, so the rig's *effective* camera scale is just
 * the wall's own scale times whichever wrapper is active — which is where the
 * two scale constants below come from:
 *
 *   pulled back   0.56              (the wall's own keyed value)
 *   zoomed in     0.56 x 1.73 = 0.9688
 *
 * At 0.9688 a 1163.024-wide tile covers 1126px of the 1080px frame, i.e. one
 * tile fills the screen with a hair of overscan. That is the design's "we are
 * looking at one short" pose, and it holds at any wall size — which is what
 * lets a hand-built 15 x 9 mock generalise to a wall built per payload.
 *
 * This file collapses the rig to a SINGLE camera (one translate plus one
 * scale). Five nested transforms only existed because each Figma wrapper can
 * carry one move; expressing the same path as one camera is both equivalent and
 * the only form that generalises to an arbitrary number of stops.
 */

import { cubicBezier } from '@/lib/cubicBezier';
import { MAX_SCREENS } from './geometry';

/** The cohort length Figma reports for this frame. */
export const DURATION_SECONDS = 21.477;

/** Fraction of Figma's timeline -> seconds. */
const at = (fraction: number) => fraction * DURATION_SECONDS;

/** Figma reports this same ease-in-out on every camera track in the rig. */
export const EASE = cubicBezier(0.5, 0, 0.5, 1);

/** Camera scale with the whole tile filling the frame. */
export const ZOOM_SCALE = 0.9688;

/** Camera scale pulled back off a tile, showing its neighbours. */
export const OVERVIEW_SCALE = 0.56;

/**
 * The beat lengths, taken from the rig's first and fullest stop (wrapper
 * 457:211164, whose scale track keys at 0.0793 / 0.1287 / 0.3863 / 0.4479 and
 * whose pan runs 0.4476 -> 0.5027).
 *
 * Figma's later stops are progressively compressed — its third and fourth get
 * 12% and 5% of the timeline against the first's 42% — which reads as the mock
 * having been laid out by hand rather than as an intended accelerando. So the
 * first stop's rhythm is the one generalised to every stop here, the same way
 * `mvp/motion.ts` extends a single-awardee design to several.
 */
export const INTRO_HOLD_SECONDS = at(0.038);
export const PULL_BACK_SECONDS = at(0.0793 - 0.038);
export const PAN_SECONDS = at(0.5027 - 0.4476);
export const ZOOM_IN_SECONDS = at(0.1287 - 0.0793);
/** How long a short holds the screen. The one number to turn to retime the loop. */
export const HOLD_SECONDS = at(0.3863 - 0.1287);
export const ZOOM_OUT_SECONDS = at(0.4479 - 0.3863);

/** One stop: pan onto the tile, zoom in, hold, zoom back out. */
export const STOP_SECONDS =
  PAN_SECONDS + ZOOM_IN_SECONDS + HOLD_SECONDS + ZOOM_OUT_SECONDS;

/** Opening: hold on the highlights card, then pull back off it. */
export const INTRO_SECONDS = INTRO_HOLD_SECONDS + PULL_BACK_SECONDS;

/**
 * When the camera starts diving onto screen `index` — 0-based over the screens,
 * so the opening card is not counted.
 *
 * Exported because a screen may have its own internal animation that has to be
 * cued off the camera's arrival rather than off the wall clock: an embedded
 * achievements collage assembles as the camera comes down onto it. Deriving that
 * from the same constants the timeline is built from is what keeps the two in
 * step — a hardcoded offset would drift the moment any beat is retimed.
 */
export function zoomInAt(index: number): number {
  return INTRO_SECONDS + index * STOP_SECONDS + PAN_SECONDS;
}

/**
 * Closing the loop: after the last short the camera flies back to the
 * highlights card and zooms in on it, which is bit-for-bit the pose the loop
 * opened on. That makes the loop point invisible — the video can run all day
 * without a visible cut, which is the whole job of an office screen.
 */
export const RETURN_SECONDS = PAN_SECONDS + ZOOM_IN_SECONDS;

/**
 * Total run time for `count` screens — shorts and achievements together, since
 * the camera spends the same beat on either.
 *
 * Unlike Figma's fixed 21.477s cohort this grows with the payload, because the
 * number of stops does: the mock's 132 tiles were placeholder filler and only a
 * handful were ever visited, whereas a real render stops once per screen.
 */
export function totalSeconds(count: number): number {
  const n = Math.max(1, Math.min(count, MAX_SCREENS));
  return INTRO_SECONDS + n * STOP_SECONDS + RETURN_SECONDS;
}
