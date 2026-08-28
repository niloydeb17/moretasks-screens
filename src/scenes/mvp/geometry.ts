/**
 * "Most Valuable Player" geometry — Figma node 1:9369 (component "Frame 290").
 *
 * Read straight off the Figma document through the Desktop Bridge plugin:
 * every node's `relativeTransform` resolved into this frame's own coordinate
 * space, plus each image fill's `imageTransform`. Nothing measured off a
 * screenshot, nothing rounded — so this file is the design, verbatim.
 *
 * Rotated and mirrored nodes carry their full matrix rather than an angle: the
 * right-hand laurel and the two left-hand rules all have negative determinants
 * (they are flipped, not merely turned), which a `rotate()` cannot express.
 */

import type { Transform } from '@/lib/figmaTransform';
import type { GradientSpec } from '@/lib/gradientText';

export type { GradientSpec };

export const CANVAS = { w: 1080, h: 1920 } as const;

const ASSETS = '/assets/mvp';

/**
 * Full-bleed backdrop. Figma names this layer "videoframe_8245 1" and fills it
 * with a still image (`scaleMode: "FILL"`, identity transform) — despite the
 * name it is not a video fill, so a plain covering image is exact here.
 */
export const BACKDROP = `${ASSETS}/backdrop.webp`;

/** The soft white disc behind the type. A plain solid ellipse in Figma. */
export const HALO = { x: -685.93, y: -286.89, size: 2511, color: '#ffffff' } as const;

/**
 * The pale starburst ("Group 2") — nine gradient blades.
 *
 * Stored by CENTRE rather than by matrix because this is the one node the
 * timeline rotates, and Figma spins it about its own middle. The centre is the
 * matrix's own result for the box's midpoint, so placing the element centred
 * here and rotating about `center center` reproduces the rest pose exactly
 * (-12.05deg) while leaving rotation free to animate.
 */
export const STARBURST = {
  src: `${ASSETS}/starburst.svg`,
  centerX: -116.93,
  centerY: 1776.36,
  w: 2331.994384765625,
  h: 2325.944580078125,
} as const;

/** Gold used by the trophy rules, the divider and its diamond. */
export const GOLD = '#e7cb82';
export const GOLD_DEEP = '#b26c00';
/** A rule that fades out; Figma's stop is transparent WHITE, not transparent black. */
export const GOLD_FADE = 'rgba(255, 255, 255, 0)';

/** Trophy row: a rule either side of a 64px trophy, at the very top. */
export const TROPHY_ROW = {
  y: 183.236328,
  height: 64,
  icon: { src: `${ASSETS}/trophy.svg`, x: 508, y: 183.236328, size: 64 },
  /** Both rules are 134x4 at the same y; the left one is mirrored in Figma. */
  ruleY: 213.236328,
  ruleW: 134,
  ruleH: 4,
  leftRuleX: 366,
  rightRuleX: 580,
} as const;

/** "MOST VALUABLE PLAYER" — Figma tracks 3%, which at 33px is 0.99px. */
export const EYEBROW = {
  y: 271.236328,
  fontSize: 33,
  letterSpacing: 33 * 0.03,
  color: '#bdc176',
} as const;

/**
 * The name block. Two lines, each its own 174px row in a 4px-gap stack, so the
 * pair occupies exactly 352px — which is what Figma reports for the frame.
 */
export const NAME = {
  y: 328.236328,
  lineHeight: 174,
  gap: 4,
  fontSize: 174,
  /** Vertical, spanning the line box: gold at the cap line into deep teal. */
  gradient: { angle: 180, stops: [{ color: '#c5c67c', at: 0 }, { color: '#007b75', at: 1 }] },
} as const satisfies { y: number; lineHeight: number; gap: number; fontSize: number; gradient: GradientSpec };

/** Divider under the name: two fading rules with a small rotated square between. */
export const DIVIDER = {
  ruleY: 734.600281,
  ruleW: 110.63603973388672,
  ruleH: 4,
  leftRuleX: 415,
  rightRuleX: 554.36,
  /** 9x9 square turned 45deg about its own top-left, landing centred on 540. */
  diamond: {
    transform: [
      [0.707107, 0.707107, 533.636719],
      [-0.707107, 0.707107, 736.600281],
    ],
    size: 9,
  },
} as const satisfies { ruleY: number; ruleW: number; ruleH: number; leftRuleX: number; rightRuleX: number; diamond: { transform: Transform; size: number } };

/** Role line plus the short rule beneath it. */
export const ROLE = {
  y: 792.964844,
  fontSize: 60,
  /** Figma's angle for this one is a hair off vertical, hence 179.93deg. */
  gradient: {
    angle: 179.92783281032888,
    stops: [
      { color: 'rgb(164, 186, 123)', at: 0.58877 },
      { color: 'rgb(42, 133, 114)', at: 0.99482 },
    ],
  },
  rule: { src: `${ASSETS}/rule.webp`, x: 433.5, y: 876.964844, w: 213, h: 4 },
} as const satisfies { y: number; fontSize: number; gradient: GradientSpec; rule: unknown };

/**
 * The laurels flanking the name. The right one is the mirrored twin, which its
 * negative-determinant matrix carries for free.
 *
 * Figma's 58% layer opacity is NOT repeated here: the exported SVG already
 * carries `opacity="0.58"` on its root group, so setting it again on the
 * wrapper would compound to 34% and wash the laurels out.
 */
export const LAURELS = {
  w: 156.6710205078125,
  h: 320.3683776855469,
  left: {
    src: `${ASSETS}/laurel-left.svg`,
    transform: [
      [0.987688, 0.156434, 41.640625],
      [-0.156434, 0.987688, 352.745087],
    ],
  },
  right: {
    src: `${ASSETS}/laurel-right.svg`,
    transform: [
      [-0.987688, -0.156434, 1038.359375],
      [-0.156434, 0.987688, 352.745087],
    ],
  },
} as const satisfies {
  w: number;
  h: number;
  left: { src: string; transform: Transform };
  right: { src: string; transform: Transform };
};

/**
 * The cut-out portrait. Figma crops the source image rather than covering with
 * it, so the fill's own `imageTransform` is kept and converted by `cropStyle`.
 */
export const PORTRAIT = {
  src: `${ASSETS}/photo.webp`,
  x: 69.5,
  y: 1024.710938,
  w: 941,
  h: 919.1953125,
  crop: [
    [1, 0, 0],
    [0, 0.5497579574584961, 0.4502420127391815],
  ],
} as const satisfies { src: string; x: number; y: number; w: number; h: number; crop: Transform };
