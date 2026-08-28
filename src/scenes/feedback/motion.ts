/**
 * "Feedback" motion — Figma node 604:57329.
 *
 * Figma states NO timing for this frame. `get_motion_context` returns
 * `motionSummary: null` and `timelineDurationMs: null`, because the pan lives on
 * the file's prototype reactions rather than on a timeline, and those are not
 * exposed. So everything here is a reconstruction, and the reasoning is spelled
 * out rather than left as bare constants.
 *
 * It is deliberately NOT the 1s-hold / 4.85s-pan the anniversary and joiner
 * cards use. Those numbers were adopted there because the strip geometry proved
 * those frames are literally the same rig; this strip is a different one (see
 * `./geometry`), and more to the point a one-second hold is the wrong shape for
 * this content. Those cards show a name. This one shows a paragraph somebody has
 * to actually read.
 */

import { cubicBezier } from '@/lib/cubicBezier';

/** The expo-out easing used for every entrance across this project's scenes. */
export const EASE_OUT_EXPO = cubicBezier(0.16, 1, 0.3, 1);

/** Figma's Smart Animate default, for the pan between cards. */
export const PAN_EASE = cubicBezier(0, 0, 0.58, 1);

/** How long one card takes to slide away and the next to arrive. */
export const PAN_SECONDS = 1.1;

/**
 * Reading speed, in words per minute, used to size each card's hold.
 *
 * The hold is derived from the quote's own length rather than fixed, because the
 * whole point of this card is the paragraph on it: a testimonial of 20 words and
 * one of 60 need visibly different amounts of screen time, and a single constant
 * would either rush the long one or stall on the short one. 180wpm is a
 * conservative silent-reading pace for uppercase, justified text, which is
 * slower to read than sentence case.
 */
const WORDS_PER_MINUTE = 180;

/** Never less than this, however short the quote — plus time to look at the face. */
const MIN_HOLD_SECONDS = 5;

/** Never more than this, so one rambling entry cannot stall the whole loop. */
const MAX_HOLD_SECONDS = 20;

/** The strip moves left to bring the next card in, so steps are negative. */
export const STRIP_STEP_SIGN = -1;

/** Cards the strip can show. Figma's own instance carries three. */
export const MAX_TESTIMONIALS = 8;

/** How long a card holds, from the length of what it says. */
export function holdSeconds(quote: string): number {
  const words = quote.trim().split(/\s+/).filter(Boolean).length;
  const reading = (words / WORDS_PER_MINUTE) * 60;
  return Math.min(MAX_HOLD_SECONDS, Math.max(MIN_HOLD_SECONDS, reading));
}

/**
 * Total run time: every card holds, and all but the last pan on.
 *
 * Mirrors how the other multi-person scenes size themselves — a single
 * testimonial holds once and never pans, so the clip is exactly its own hold.
 */
export function totalSeconds(quotes: readonly string[]): number {
  const list = quotes.slice(0, MAX_TESTIMONIALS);
  if (list.length === 0) return MIN_HOLD_SECONDS;
  const holds = list.reduce((sum, q) => sum + holdSeconds(q), 0);
  return holds + PAN_SECONDS * (list.length - 1);
}

/** When card `index` starts panning away. */
export function panStartsAt(quotes: readonly string[], index: number): number {
  const list = quotes.slice(0, MAX_TESTIMONIALS);
  let at = 0;
  for (let i = 0; i <= index; i += 1) {
    at += holdSeconds(list[i] ?? '');
    if (i < index) at += PAN_SECONDS;
  }
  return at;
}

/**
 * The entrance, in the same expo-out language every other scene in this project
 * opens with. Figma states none, so this is a reconstruction; it is kept short so
 * it finishes well inside the first card's hold.
 */
export const ENTRANCE = {
  riseDistance: 40,
  duration: 0.5,
  stagger: 0.08,
  groups: ['card', 'open-quote', 'body', 'person', 'close-quote'] as const,
} as const;
