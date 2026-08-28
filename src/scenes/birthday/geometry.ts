/**
 * Birthday scene geometry.
 *
 * Every number here was measured from the native-resolution Figma render
 * (`reference/birthday-1080x1920.png`), then cross-checked against the values
 * `get_design_context` reported for node 1:9541. Where the two agree the value
 * is exact, not eyeballed:
 *
 *   card      856x1227 @ (112,411)   <- Figma w-[855.747] h-[1227.068]
 *   border    20px                   <- Figma border-20
 *   caption   856x217 at card bottom <- 24 + 91 + 10 + 68 + 24 = 217
 *   photo     816x990 @ (132,431)    <- card inset by the 20px border
 *
 * Do not "tidy" these into round numbers; they are the design.
 */

export const CANVAS = { w: 1080, h: 1920 } as const;

export const CARD = { x: 112, y: 411, w: 856, h: 1227 } as const;

/** White frame around the photo — the polaroid edge. */
export const CARD_BORDER = 20;

/** White caption band across the bottom of the card. */
export const CAPTION_HEIGHT = 217;

/**
 * Photo box: the card inset by its border, with the caption band laid over the
 * bottom edge (matching the Figma layer stack).
 *
 * Deliberately NOT tuned to reproduce Figma's crop of the placeholder stock
 * photo. The photo is dynamic — HR uploads arbitrary dimensions — so the goal is
 * a predictable, well-framed crop of any image, not a pixel match against one
 * sample.
 */
export const PHOTO = {
  x: CARD.x + CARD_BORDER,
  y: CARD.y + CARD_BORDER,
  w: CARD.w - CARD_BORDER * 2,
  h: CARD.h - CARD_BORDER * 2,
} as const;

/** How much of the photo the caption band leaves visible. */
export const PHOTO_VISIBLE_HEIGHT = CARD.h - CARD_BORDER - CAPTION_HEIGHT;

/**
 * Party hat, relative to the card's own top-left corner — Figma's own child
 * offset ("Frame 243" inside "Frame 236/BIRTHDAY CARD"). Kept relative to the
 * card so it swings rigidly with its card around the ring, rather than sitting
 * fixed while the card rotates away.
 */
export const HAT_LOCAL = { x: -56, y: -358, w: 351, h: 518.1871948242188 } as const;

/* ------------------------------------------------------------------------ *
 * The card carousel — Figma component set "Frame 236" (node 1:12356)
 * ------------------------------------------------------------------------ */

/**
 * The rotating plane ("Frame 235") holding all 16 card slots.
 *
 * `centerX/centerY` is where it pivots, in canvas coordinates. Confirmed
 * rotation-invariant: the frame's centre measures (540, 6638.07) in every
 * variant sampled, whatever that variant's rotation — so the ring turns about
 * its own centre, and `left/top` below is just that centre minus half its size.
 */
export const RING = {
  centerX: 540,
  centerY: 6638.07,
  size: 12454.134765625,
} as const;

export const RING_LEFT = RING.centerX - RING.size / 2;
export const RING_TOP = RING.centerY - RING.size / 2;

/**
 * The 16 card slots, in the ring's own (unrotated) local space, read from the
 * "No of Cards=16, Card No.1=1" variant. Each sits at a different angle around
 * the ring; the one whose `rot` is cancelled by the ring's current rotation is
 * the one facing the viewer at CARD's position.
 *
 * Sanity check on the two that must agree: slot `rot: 0` is at local
 * (5799.195, 0), and RING_LEFT + 5799.195 = 112.13, RING_TOP + 0 = 411.00 —
 * exactly CARD.x/CARD.y.
 */
export const RING_SLOTS: readonly { x: number; y: number; rot: number }[] = [
  { x: 4187.813, y: 327.842, rot: 157 },
  { x: 2126.426, y: 1521.326, rot: 135 },
  { x: 12160.99, y: 8163.832, rot: 112 },
  { x: 12454.135, y: 5799.197, rot: 90 },
  { x: 11741.745, y: 3303.77, rot: 66 },
  { x: 10327.715, y: 1521.326, rot: 45 },
  { x: 8266.319, y: 328.193, rot: 23 },
  { x: 5799.195, y: 0, rot: 0 },
  { x: 8266.313, y: 12126.299, rot: -23 },
  { x: 10327.724, y: 10932.832, rot: -45 },
  { x: 293.15, y: 4291.865, rot: -68 },
  { x: 0, y: 6654.943, rot: -90 },
  { x: 712.392, y: 9151.086, rot: -114 },
  { x: 2126.417, y: 10932.832, rot: -135 },
  { x: 4187.82, y: 12126.65, rot: -157 },
  { x: 6654.942, y: 12454.135, rot: -180 },
] as const;

/**
 * The ring's rotation for each "Card No.1=k" variant, k = 1..16, read straight
 * off those variants. Unwrapped into one continuously decreasing sequence:
 * Figma stores these normalised to (-180, 180], so k >= 10 comes back positive
 * (157, 135, …) — subtracting 360 turns the wrap-around back into the steady
 * ~-22.5deg-per-step turn it actually is, which is what keeps the tween from
 * spinning the long way round at that boundary.
 */
export const RING_ROTATIONS: readonly number[] = [
  0, -23, -45, -68, -90, -114, -135, -157, -180, -203, -225, -248, -270, -294, -315, -337,
];

/** How many people this rig can show before it runs out of slots. */
export const MAX_CARDS = RING_ROTATIONS.length;

/**
 * The prototype interaction, from the component set's own reactions:
 * `AFTER_TIMEOUT` 5s -> `SMART_ANIMATE` / `GENTLE` / 2.555234432220459s, each
 * variant pointing at the next ("Card No.1=1" -> "=2" -> "=3" -> …).
 *
 * `durationSeconds` is the exact value the Plugin API reports; Figma's
 * interaction panel displays the same transition rounded to "2000ms".
 *
 * The chain does NOT loop: the last card in a set (Card No.1=N) carries no
 * reaction at all, so the carousel plays through each person once and rests on
 * the final card. A one-person set has no reaction anywhere and never moves.
 */
export const CAROUSEL = {
  holdSeconds: 5,
  durationSeconds: 2.555234432220459,
} as const;

/**
 * "Gentle" — the named Smart Animate easing on that interaction — as real
 * mass-spring-damper physics. The Plugin API only ever exposes the preset's
 * name; these constants came from a raw motion-timeline export of an actual
 * "Gentle" transition in this file. See `springEase()` in `@/lib/spring`.
 */
export const GENTLE_SPRING = { mass: 1, stiffness: 100, damping: 15 } as const;

/**
 * Which slot faces the viewer at step `index` (0-based).
 *
 * A slot is face-on when its own rotation cancels the ring's, i.e. when
 * `slot.rot + ringRotation` is a multiple of 360. Picking the closest match
 * rather than requiring an exact zero absorbs the ~2deg of rounding Figma has
 * baked into a few of these angles (e.g. a 112deg slot against a -114deg ring).
 */
export function activeSlotIndex(index: number): number {
  const ringRotation = RING_ROTATIONS[index % MAX_CARDS];
  let best = 0;
  let bestDistance = Infinity;
  RING_SLOTS.forEach((slot, i) => {
    // Normalise the slot's resulting angle into [-180, 180); its magnitude is
    // how far that slot still is from facing the viewer, so the smallest wins.
    const distance = Math.abs(((((slot.rot + ringRotation) % 360) + 540) % 360) - 180);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/**
 * The ring rotation that actually seats `activeSlotIndex(step)` flush at
 * CARD's position, for every step — the value the scene should animate to,
 * in place of `RING_ROTATIONS[step]`.
 *
 * `RING_SLOTS` and `RING_ROTATIONS` were each read off a different Figma
 * variant, and Figma's inspector rounds every value to a whole degree, so a
 * few steps carry up to ~2deg of disagreement between "the rotation Figma
 * reports for this variant" and "the rotation that exactly cancels this
 * slot's own baked-in counter-rotation" (e.g. step 3 lands on the 66deg slot
 * against a -68deg ring). That is invisible on an ordinary UI element, but
 * this ring is ~12,450px across — 2 degrees of left-over rotation swings the
 * card's anchor point by the arc length at that radius, roughly 218px, which
 * reads as a visibly wrong, tilted card rather than a rounding blur.
 *
 * Each entry here is `RING_ROTATIONS[step]` nudged by the smallest signed
 * correction that makes it exactly cancel its slot's rotation modulo 360,
 * rather than a value rederived from the slots alone — rederiving would lose
 * the continuous, monotonically-decreasing sequence `RING_ROTATIONS` was
 * deliberately unwrapped into (see that constant's own comment), snapping
 * back into (-180, 180] every 8 steps and sending the tween the long way
 * round. The correction is always small (verified below at module load:
 * every step is within a few degrees of its source value), so the motion's
 * timing and feel are unchanged — only the few steps that were landing off
 * their mark now land exactly on it.
 */
export const RING_REST_ROTATIONS: readonly number[] = RING_ROTATIONS.map((ringRotation, step) => {
  const target = -RING_SLOTS[activeSlotIndex(step)].rot;
  const delta = (((target - ringRotation + 180) % 360) + 360) % 360 - 180;
  return ringRotation + delta;
});

if (RING_REST_ROTATIONS.some((v, i) => Math.abs(v - RING_ROTATIONS[i]) > 5)) {
  throw new Error('RING_REST_ROTATIONS diverged from RING_ROTATIONS by more than a rounding-sized amount');
}

/** Seconds of motion for `count` people: each holds, and each gap is one turn. */
export function carouselSeconds(count: number): number {
  const n = Math.max(1, Math.min(count, MAX_CARDS));
  return n * CAROUSEL.holdSeconds + (n - 1) * CAROUSEL.durationSeconds;
}

/** Colours sampled from the reference render, not picked by eye. */
export const COLORS = {
  /** Page background. */
  bg: '#f66341',
  /** Tiled "HAPPY BIRTHDAY" display type. */
  tiledType: '#fedc8f',
  /** Polaroid frame and caption band. */
  cardWhite: '#ffffff',
  /** Name line. */
  nameText: '#1b1b1b',
  /** Date line. */
  subtitleText: '#787878',
} as const;

/** Card drop shadow, straight from Figma. */
export const CARD_SHADOW = '0px 37px 19.9px 0px rgba(121, 26, 4, 0.58)';

/**
 * The looping background footage — Figma's "Stretched-Type-Repeater 1", a
 * rectangle carrying a `VIDEO` fill (confirmed by reading its paint type
 * through the Plugin API, which is also why every code-generation path returns
 * this layer as an empty node).
 *
 * The rect overscans the 1080x1920 canvas slightly and sits a hair off-origin,
 * exactly as Figma places it; the fill is `FILL` mode, so the footage covers
 * that box. The clip is 1080x1920 @ 30fps, and it loops independently of the
 * card carousel rather than being part of that interaction.
 *
 * Never played — `seekVideoToFrame` drives it, so a captured frame always shows
 * the same footage position. See `@/lib/videoSync`.
 */
export const BACKDROP_VIDEO = {
  src: '/assets/birthday/Stretched-Type-Repeater.mp4',
  x: -45.80419158935547,
  y: -0.0693359375,
  w: 1171.60400390625,
  h: 2082.8515625,
} as const;
