/**
 * "Feedback" geometry — Figma node 604:57329 in file BPG2IS230Tr5g6YITfEdXg
 * (Placeholders), whose strip is the instance 604:57330.
 *
 * A teal plate with a white testimonial card on it: a big pair of quote marks at
 * the top, the quote set justified and uppercase, and the person at the bottom
 * left with a tilted photo. Three cards sit side by side in a horizontal strip
 * that pans one testimonial at a time.
 *
 * This is NOT the carousel rig the anniversary/joiner/farewell cards share, and
 * it is worth saying so explicitly because four scenes in this project do share
 * one. Those have a thirteen-slot strip of 698.713-wide slides stepping 760.364;
 * this has three 1132.033-wide cards stepping 1185.033. Different rig, its own
 * numbers, no shared module.
 *
 * All values below are Figma's own, from `get_design_context` on the frame.
 */

export const CANVAS = { w: 1080, h: 1920 } as const;

/** The plate behind the cards, and what shows below the card's angled edge. */
export const BACKGROUND = '#03b5aa';

/**
 * The strip of cards.
 *
 * `x` is negative and the card is wider than the canvas, so the card bleeds off
 * both edges by design rather than sitting inside a margin. `step` is
 * `CARD.w + gap`, the auto-layout distance between adjacent cards.
 */
export const STRIP = {
  x: -25.015625,
  y: 0,
  gap: 53,
  step: 1185.033,
} as const;

export const CARD = { w: 1132.033, h: 1797.706 } as const;

/**
 * The white card itself.
 *
 * Figma exports this as a one-path SVG, but the path is a quadrilateral — the
 * bottom edge is a diagonal, dropping from y 1715.65 on the right to y 1797.71
 * on the left, which is what makes the teal read as a slanted band across the
 * bottom of the frame. So it is a `clip-path` here rather than a fetched asset:
 * same four points, nothing to load, and it survives the MP4 exporter (which
 * inlines `<img>` elements but would drop a CSS `background-image`).
 *
 * The 1130.72 rather than 1132.033 on the top-right corner is Figma's own value,
 * kept as-is; it is a 1.3px bevel, not a rounding slip on my part.
 */
export const PLATE = {
  fill: '#ffffff',
  clip: 'polygon(0 0, 1130.72px 0, 1132.03px 1715.65px, 0 1797.71px)',
} as const;

/**
 * The quote marks.
 *
 * Figma builds each pair from two copies of an `mdi:comma` glyph in a flex row,
 * the first pulled left by 69.572 so they overlap, with a transform on each
 * comma AND another on the pair. Both nestings are reproduced literally in the
 * scene rather than collapsed into one transform, because collapsing them is
 * easy to get wrong: `rotate(180)` then `scaleY(-1)` is a horizontal mirror, not
 * a vertical one, so the "obvious" simplification flips the glyph the wrong way.
 *
 * The two SVGs Figma emits for the two commas differ only in the fourth decimal
 * of their path (44.8522 against 44.86), so this is one glyph used twice. Its
 * path is inlined rather than loaded — it is a single `d` attribute, and inlining
 * it means no fetch and nothing for the exporter to miss.
 */
export const QUOTE = {
  /** The glyph's own box; the path is authored in this coordinate space. */
  box: 153.786,
  path: 'M44.8522 19.2231H108.609V83.0442L83.0423 134.178H51.2599L76.6986 83.0442H44.8522V19.2231Z',
  fill: '#3AC0B8',
  opacity: 0.34,
  /** Figma's negative margin on the first comma of the pair. */
  overlap: -69.572,
  /** `box * 2 + overlap` — the pair's own width. */
  pairW: 238,
  /** Opening pair: the pair is flipped, each comma turned. */
  open: { x: 39.64, y: 34.75 },
  /** Closing pair: the pair is turned, each comma turned — a net no-op. */
  close: { x: 822.64, y: 1410.55 },
} as const;

/**
 * The quote text.
 *
 * `lineHeight` is a multiplier, as Figma states it — 1.74 against 33px, so 57.42
 * a line. The paragraphs carry no margin between them (Figma sets `mb-0`), so
 * they run on at the same spacing as the lines inside them.
 */
export const BODY = {
  x: 101.47,
  y: 90.53,
  w: 926.289,
  fontSize: 33,
  lineHeight: 1.74,
  color: '#003f3b',
} as const;

/** The person, bottom left: tilted photo, then name over role. */
export const FOOTER = {
  x: 101.47,
  y: 1487.44,
  /** Between the photo unit and the text column. */
  gap: 49,
  photo: {
    /** The unit's own box; the square and the image are placed inside it. */
    box: 160,
    /** The orange card behind the photo, turned and centred in the box. */
    card: { size: 139.845, rotation: -9, fill: '#f76341' },
    /** The photo, offset down-right so the orange shows at the top left. */
    image: { size: 139.845, x: 20.16, y: 20.15, placeholder: '#d9d9d9' },
  },
  text: {
    /**
     * The name/role column hugs its content rather than sitting at a fixed
     * width.
     *
     * Figma's codegen reports `w-[425px]`, but that 425 is a measurement, not an
     * intent: it is almost exactly the width of "Social PR Manager" — the widest
     * of the three roles the design ships — at 48px Inter Regular. Treating it as
     * a hard width wraps that role onto two lines here, because next/font's
     * variable Inter renders it at 426.9px, 0.45% wider than the static Inter
     * Figma measured. Hugging reproduces what the design does; `maxW` is the
     * room left on the card once the photo and the two 101.47 insets are taken
     * out, so a genuinely long role still wraps instead of running off the edge.
     */
    maxW: 720.09,
    color: '#353535',
    lineHeight: 1.74,
    name: { fontSize: 64, weight: 800, pullUp: -22 },
    role: { fontSize: 48, weight: 400 },
  },
} as const;
