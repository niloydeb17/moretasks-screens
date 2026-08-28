/**
 * "Farewell" geometry — Figma node 6:2655 in file Yje5sXQV7QUDigZx08fs9A.
 *
 * Only the four values that differ from the new-joinee frame live here; the rest
 * of the card is shared. See the note on `Variant` in
 * `../new-joinee/geometry.ts` for why, and `FarewellScene` for what that buys.
 *
 * Read from the frame's own nodes:
 *   eyebrow      6:2679  "GoodBye" — replaced with "See You Soon" on request
 *   heading      6:2684  "UNTIL WE MEET AGAIN", set in caps
 *   glyph        10:2806 handshake, 58.677 x 53.307 inset in a 64px box
 *   lower glow   6:2672  linear #001D2B -> black
 */

import { WELCOME_VARIANT, type Variant } from '../new-joinee/geometry';

const ASSETS = '/assets/farewell';

/**
 * The handshake glyph.
 *
 * Figma insets it within the rule's 64px box (`8.33% 4.17% 8.37% 4.15%`), which
 * resolves to the offsets below. The box itself stays 64px so the rule either
 * side of it keeps the same length as the welcome variant's.
 */
const HANDSHAKE = {
  src: `${ASSETS}/handshake.svg`,
  x: 0.0415 * 64,
  y: 0.0833 * 64,
  w: 58.6773,
  h: 53.3067,
} as const;

export const FAREWELL_VARIANT: Variant = {
  // Every colour in this frame matches the welcome one — plate, upper glow,
  // rules, type inks, footer — so they are inherited rather than restated. Only
  // the four values listed at the top of this file are overridden.
  ...WELCOME_VARIANT,
  eyebrow: 'See You Soon',
  title: 'UNTIL WE MEET AGAIN',
  // Figma sets this heading in caps, unlike the welcome variant's.
  titleUppercase: true,
  icon: HANDSHAKE,
  /**
   * Same ellipse and same gradient geometry as the welcome variant's lower glow,
   * starting from #001D2B rather than #01201E. The negative first stop is not a
   * fudge: Figma runs the gradient from y -98.142 to y 570.213 against a box only
   * 570.361 tall, so it is already 14.68% along at the box's top edge.
   */
  bottomGlow: 'linear-gradient(to bottom, #001D2B -14.68%, #000000 100%)',
};
