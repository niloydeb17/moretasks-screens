/**
 * "Quote" geometry — Figma node 1:110 (Frame 282) in file Yje5sXQV7QUDigZx08fs9A.
 *
 * A quote card: a collage of circles and an arch-cropped portrait above, the
 * quote and its attribution below, with a pair of comma marks closing it out.
 *
 * Every number here is Figma's own, from `get_design_context`. The layout is
 * kept as the design expresses it — a vertically centred flex column — rather
 * than flattened to absolute offsets, because the quote is data-driven: a longer
 * or shorter quote has to reflow and stay centred, which absolute positions
 * would not do.
 */

const ASSETS = '/assets/quote';

export const CANVAS = { w: 1080, h: 1920 } as const;

/** The column everything sits in, centred vertically on the canvas. */
export const COLUMN = { left: 34.5, width: 1010, gap: 72 } as const;

/**
 * The collage band.
 *
 * `inner` is wider than the column and hangs off both sides — Figma gives it
 * `right: -230` inside the 1010 column, which puts its left edge at 2 and its
 * width at 1238. The band's own height is fixed; the shapes inside are placed
 * absolutely against it.
 */
export const COLLAGE = {
  height: 767,
  inner: { left: 2, width: 1238, height: 766.902 },
} as const;

/** Thin outlined circle, upper right of the collage. */
export const OUTLINE_CIRCLE = {
  left: 617.5,
  top: 0,
  size: 314,
  stroke: '#00302D',
  /** Sub-pixel in the design; kept exact rather than rounded up to a hairline. */
  strokeWidth: 0.608527,
} as const;

/**
 * The orange shape and the small dot that travels across it.
 *
 * `shape.radius` is applied to three corners only — the fourth is square, which
 * is what gives the blob its leaf shape. Figma draws it flipped (`rotate(180)`
 * plus `scaleY(-1)`), and the motion tracks animate from exactly that pose, so
 * the flip belongs in the initial transform rather than baked into the markup.
 */
export const ORANGE = {
  group: { left: 0, top: 261, width: 386, height: 382.998 },
  shape: {
    width: 386,
    height: 382.998,
    fill: '#f76341',
    radius: 462.75,
    initial: { rotation: 180, scaleX: 1, scaleY: -1 },
  },
  dot: {
    left: 79.2,
    top: 269.19,
    size: 80.634,
    fill: '#FFD371',
    /** The dot starts below its resting place and rides up. */
    initialY: 31.489,
  },
} as const;

/**
 * The arch holding the portrait.
 *
 * Same three-corner rounding as the orange shape, unflipped. Figma centres it
 * with `left: calc(50% - 113.5)` plus a -50% shift inside the 1238 band, which
 * resolves to 206.5.
 */
export const PORTRAIT = {
  left: 206.5,
  top: 38,
  width: 598,
  height: 593.35,
  radius: 692.783,
  /** Shows through wherever the photo is transparent or still loading. */
  backdrop: '#d9d9d9',
  shadow: '0px 0px 96.6px 0px rgba(0, 0, 0, 0.1)',
  placeholder: `${ASSETS}/portrait-placeholder.webp`,
} as const;

/** The large cyan circle, lower right. */
export const CYAN_CIRCLE = {
  left: 852,
  top: 380.9,
  size: 386,
  fill: '#49DFD6',
} as const;

export const TEXT = {
  /** Both the quote and the attribution use this ink. */
  color: '#003f3b',
  quote: {
    fontSize: 56,
    /** Figma's `leading-[2]` — twice the size. */
    lineHeight: 2,
    weight: 600,
  },
  attribution: {
    fontSize: 56,
    lineHeight: 1.74,
    weight: 400,
    /** Figma fixes this row's height regardless of the line box. */
    height: 69.173,
  },
} as const;

/**
 * The rule between quote and attribution: two gradient bars fading outward from
 * a small rotated square in the middle.
 */
export const DIVIDER = {
  width: 250,
  gap: 8,
  barHeight: 6,
  color: '#d2eceb',
  dot: { box: 12.728, size: 9, radius: 74, rotation: -45 },
} as const;

/**
 * The closing comma pair.
 *
 * Two copies of the same glyph, overlapping by `overlap`, the whole group held
 * at 18% and turned upside down — which is what makes a pair of commas read as a
 * quote mark.
 */
export const COMMAS = {
  src: `${ASSETS}/comma-a.svg`,
  size: 122.886,
  overlap: 55.771,
  opacity: 0.18,
} as const;

/** Inner gap of the text stack (quote / divider / attribution). */
export const TEXT_GAP = 16;
