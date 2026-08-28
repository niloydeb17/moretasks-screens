/**
 * "New Joinees" motion — Figma node 6:2529.
 *
 * Two parts, with very different provenance, and it is worth being explicit
 * about which is which:
 *
 *  - THE CAROUSEL is the design's. Figma's motion export for this frame comes
 *    back with a 2000ms cohort and seven member nodes whose tracks are all
 *    empty (`initial={{}} animate={{}}`), because the pan lives on the component
 *    set's prototype reactions, not on a timeline. The strip's geometry is
 *    identical to the anniversary frame's to the last decimal, so its reaction
 *    values — a 1s hold and a 4.85s "Gentle" pan — are the ones that apply.
 *
 *  - THE ENTRANCE is a reconstruction, in the same expo-out language every other
 *    entrance in this project uses. Figma states no values for it. It is
 *    deliberately short so it finishes inside the carousel's first hold.
 */

import { springEase } from '@/lib/spring';
import { cubicBezier } from '@/lib/cubicBezier';
import { CAROUSEL, GENTLE_SPRING } from './geometry';

/** The expo-out easing used for every entrance across this project's scenes. */
export const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

/** "Gentle" Smart Animate, resolved for the carousel's one fixed step duration. */
export const GENTLE_EASE = springEase(
  GENTLE_SPRING.mass,
  GENTLE_SPRING.stiffness,
  GENTLE_SPRING.damping,
  CAROUSEL.durationSeconds,
);

/**
 * How many people the strip will show.
 *
 * Figma's own strip is thirteen slides, and this used to be `STRIP.count - 2` on
 * the reasoning that two of them are wrap-around peeks of the last and first
 * person. But the strip is BUILT from the data — the scene renders
 * `people.length + 2` slides, not thirteen — so thirteen was only ever the
 * number the designer happened to lay out, never a mechanical ceiling. Raised
 * because a real month's farewell list ran to fourteen names and silently
 * dropping three people off the end of a goodbye card is the worst possible
 * failure for this template.
 */
export const MAX_PEOPLE = 24;

/** How many joinees this render shows, clamped to what the strip can hold. */
export function personCount(count: number | undefined): number {
  return count && count > 0 ? Math.min(count, MAX_PEOPLE) : MAX_PEOPLE;
}

/** Seconds of motion for `count` joinees: each holds, then all but the last pan on. */
export function carouselSeconds(count: number | undefined): number {
  const n = personCount(count);
  return n * CAROUSEL.holdSeconds + (n - 1) * CAROUSEL.durationSeconds;
}

/**
 * Entrance timing for the static header, and for the first joinee's name block.
 *
 * Every later joinee's name crossfades with the pan instead — the name has to
 * change while the strip is moving, or it would still be reading the previous
 * person once the next card lands.
 */
export const ENTRANCE = {
  riseDistance: 40,
  duration: 0.5,
  stagger: 0.08,
  groups: ['glow', 'rule', 'eyebrow', 'title', 'title-divider', 'strip'] as const,
} as const;

/** The first joinee's name block enters last, right after the strip. */
export const NAME_BLOCK_ENTRANCE_DELAY = ENTRANCE.groups.length * ENTRANCE.stagger;

/** How long a departing joinee's name takes to give way to the next. */
export const NAME_CROSSFADE_SECONDS = 0.4;
