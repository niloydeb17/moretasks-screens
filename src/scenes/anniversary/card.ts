/**
 * Anniversary card variants — Figma nodes 17:5113 (silver) and 26:5675 (gold)
 * in file Yje5sXQV7QUDigZx08fs9A.
 *
 * Both frames are the SAME rig as New Joinees and Farewell. That is measured,
 * not assumed: the strip window, slide size, gap, step and slide count all close
 * to the last decimal across the four frames, and the header/footer skeleton is
 * shared too. So these are variants of that card rather than a fourth copy of
 * it — see the note on `Variant` in `../new-joinee/geometry.ts`.
 *
 * What the anniversary frames add:
 *   - a laurel either side of the footer (17:5131)
 *   - an eyebrow and heading that carry a person's own copy
 *
 * There is no third footer line here — no tenure, no role. That was tried
 * ("1 Year" / "2+ Years") and then explicitly asked to come back out: the
 * card should stop at the name. `Variant.subline` is optional for exactly
 * this reason, and neither palette below sets it.
 *
 * Which of the two palettes is used follows the year count: silver for a first
 * anniversary, gold from the second on. That is the design's own split, and it
 * is what the panel's experience toggle drives.
 *
 * The eyebrow and heading are FREEFORM per person (`Person.eyebrowText` /
 * `titleText`) rather than computed from the year count. That replaced an
 * earlier "Celebrating 1st/2nd/3rd..." ordinal: real anniversary copy varies by
 * more than a number — the newsletter's own examples are "One Year Together",
 * "MoreTasks Growth Club", "MoreTasks Legacy Club" — so a formula could never
 * cover it. Each falls back to sensible default wording when nothing is typed.
 */

import type { CardPerson, Laurels, Variant } from '../new-joinee/geometry';

const ASSETS = '/assets/anniversary-card';

/**
 * The star glyph on the header rule.
 *
 * Figma insets it within the rule's 64px box (`8.33% 8.33% 12.5% 8.33%`). The
 * box stays 64px so the bars either side keep the joiner variants' length.
 */
const STAR = { x: 0.0833 * 64, y: 0.0833 * 64, w: 53.3333, h: 50.6667 } as const;

/**
 * The laurel pair (17:5131).
 *
 * Figma's two children are byte-identical apart from their element ids, so one
 * asset is used twice and the side supplies the transform. Both angles are
 * Figma's own — see the note on `Laurels` for why the right one is -171 rather
 * than the -189 a naive mirror of -9 would suggest.
 */
const LAUREL = {
  w: 188.59,
  h: 238.213,
  innerW: 156.671,
  innerH: 216.368,
  rotation: { left: -9, right: -171 },
  overlap: -26,
  opacity: 0.58,
} as const;

/** The label above the heading — a static line unless the person typed their own. */
function eyebrow(defaultText: string) {
  return (person: CardPerson): string => person.eyebrowText || defaultText;
}

/** The heading itself — a static line unless the person typed their own. */
function title(defaultText: string) {
  return (person: CardPerson): string => person.titleText || defaultText;
}

const laurels = (src: string): Laurels => ({ ...LAUREL, src: `${ASSETS}/${src}` });

/**
 * Silver — a first anniversary. Figma node 17:5113.
 *
 * The upper glow's centre and radii come from unwinding Figma's transform
 * `translate(972.349 85.5542) rotate(90) scale(728.967 2568)`: the rotation
 * swaps the radii, so 2568 is the horizontal one. The lower glow runs from y 0
 * to y 492.675 against a 570.361-tall box, which is why its last stop lands at
 * 86.38% rather than 100% — 492.675 / 570.361.
 */
export const SILVER_ANNIVERSARY: Variant = {
  plate: 'linear-gradient(to bottom, #6b7280 26.148%, #313945 74.152%)',
  topGlow:
    'radial-gradient(2568px 728.967px at 972.349px 85.5542px, ' +
    '#FFFFFF 0%, #E5E7EB 25%, #9CA3AF 45%, #6B7280 65%, #374151 85%, #111827 100%)',
  bottomGlow: 'linear-gradient(to bottom, #323A46 0%, #060809 86.38%)',
  rule: { from: '#858c99', to: 'rgba(255, 255, 255, 0)' },
  icon: { src: `${ASSETS}/silver-star.webp`, ...STAR },
  eyebrow: eyebrow('Work Anniversaries'),
  eyebrowColor: '#858c98',
  title: title('One Year Together'),
  // Not the design's original all-caps treatment: this is now typed copy
  // ("One Year Together", or whatever a person's own titleText says), and
  // forcing freeform text into caps reads as shouting rather than a heading.
  titleUppercase: false,
  titleColor: '#707785',
  headerDivider: { from: '#566376', to: 'rgba(65, 68, 73, 0)', dot: '#414b5a' },
  footerDivider: { from: '#ffffff', to: 'rgba(255, 255, 255, 0)', dot: '#ffffff' },
  footerTop: 1546.66,
  nameFill: '#ffffff',
  laurels: laurels('silver-laurel-a.svg'),
};

/**
 * Gold — a second anniversary or later. Figma node 26:5675.
 *
 * Same geometry as silver throughout; the glows' transforms differ only in their
 * radii (`scale(617.529 2105.52)`) and centre y. The name and tenure are painted
 * with gradients rather than flat inks, which the scene runs through the glyphs.
 */
export const GOLD_ANNIVERSARY: Variant = {
  plate: 'linear-gradient(to bottom, #d39436 26.148%, #8c5502 74.152%)',
  topGlow:
    'radial-gradient(2105.52px 617.529px at 972.349px 80.2114px, ' +
    '#FCF8F2 10.98%, #FFC97D 52.55%, #B9750D 92.09%)',
  bottomGlow: 'linear-gradient(to bottom, #8F5702 0%, #3D2000 86.38%)',
  rule: { from: '#b87000', to: 'rgba(184, 112, 0, 0)' },
  icon: { src: `${ASSETS}/gold-star.webp`, ...STAR },
  eyebrow: eyebrow('Work Anniversaries'),
  eyebrowColor: '#c27700',
  title: title('WORK ANNIVERSARY'),
  titleUppercase: false,
  titleColor: '#a76600',
  headerDivider: { from: '#b87000', to: 'rgba(184, 112, 0, 0)', dot: '#b87001' },
  footerDivider: { from: '#ffc64c', to: 'rgba(255, 198, 76, 0)', dot: '#efb744' },
  footerTop: 1546.66,
  nameFill: 'linear-gradient(to top, #f9d988, #fef7e7)',
  laurels: laurels('gold-laurel-a.svg'),
};

/** The design's own split: silver for the first anniversary, gold after it. */
export function variantForYears(years: number): Variant {
  return years >= 2 ? GOLD_ANNIVERSARY : SILVER_ANNIVERSARY;
}
