/**
 * "Personal Achivements & Desk Diaries" motion — Figma node 1:10192.
 *
 * Read from the design's own keyframe tracks (`get_motion_context`), not invented.
 * Figma reports one timeline cohort: 2000ms, looping, with 13 animated nodes.
 *
 * Every track has the same shape — four keyframes at `times [0, t1, t2, 1]` holding
 * the initial value, easing to the final value, then holding. So a track collapses
 * without loss to a delay, a duration and one ease:
 *
 *     delay = t1 · 2000ms      duration = (t2 - t1) · 2000ms
 *
 * The `linear` segments Figma reports on either side are the holds, which GSAP gets
 * for free: a `.from()` tween renders its start state before it begins and leaves
 * the end state in place after it finishes.
 */

import { cubicBezier } from '@/lib/cubicBezier';

/** Length of the Figma cohort that drives the collage's entrance. */
export const DURATION_SECONDS = 2;

/**
 * The cloud plate's drift — Figma node 3:148 in the revised frame.
 *
 * Read straight from the design's own track: `x: [0, -2829.5]` across the
 * cohort, linear, no easing. That is 117.8 px/s, or 3.93 px/frame.
 *
 * This supersedes an earlier value of 9.9028 px/frame, which was measured by
 * optical flow off a screen recording when this file's MCP quota was spent. The
 * measurement overshot by roughly 2.5x — worth recording, because it is the
 * reason the drift read as too fast.
 *
 * The travel also fits inside a single plate: 2829.5px against the 4036px of
 * headroom a 5116-wide plate has over the 1080 canvas. So there is no tiling
 * here any more — one copy, panned once. The mirrored triple this file used to
 * describe existed only to cover a travel that turned out not to be real.
 */
export const CLOUD_TRAVEL_PX = 2829.5;

/** The cohort Figma reports for the revised frame. */
export const CLOUD_CYCLE_SECONDS = 24.01233;

/** 720.37 exactly; the composition rounds to 720. */
export const CLOUD_CYCLE_FRAMES = Math.round(CLOUD_CYCLE_SECONDS * 30);

/**
 * The single easing curve in this design, on every track. Figma's expo-out.
 */
export const EASE = cubicBezier(0.16, 1, 0.3, 1);

export interface Track {
  /** Figma node id this track came from. */
  id: string;
  /** `data-motion` value of the element it drives. */
  target: string;
  /** Seconds from the start of the loop. */
  delay: number;
  duration: number;
  /** The value the element animates *from*; the design's rest state is the end. */
  from: { opacity: number; scale?: number; y?: number };
}

/**
 * Tracks in Figma document order.
 *
 * The photos rise and settle (`y: 30`, `scale: 0.95`); the desk oddments pop in
 * place (`scale: 0.85`); the title drops in and the closer rises. Note the photos'
 * `y` is applied inside each card's rotated frame, so a card slides along its own
 * tilt rather than straight up the canvas — as it does in Figma.
 */
export const TRACKS: readonly Track[] = [
  // Photos, in the order the collage assembles: left, top, centre, bottom-left,
  // bottom-right. Not document order — the design deliberately staggers them.
  { id: '1:10195', target: 'card-1:10195', delay: 0.1, duration: 0.7, from: { opacity: 0, scale: 0.95, y: 30 } },
  { id: '1:10193', target: 'card-1:10193', delay: 0.25, duration: 0.7, from: { opacity: 0, scale: 0.95, y: 30 } },
  { id: '1:10196', target: 'card-1:10196', delay: 0.4, duration: 0.7, from: { opacity: 0, scale: 0.95, y: 30 } },
  { id: '1:10197', target: 'card-1:10197', delay: 0.55, duration: 0.7, from: { opacity: 0, scale: 0.95, y: 30 } },
  { id: '1:10194', target: 'card-1:10194', delay: 0.7, duration: 0.7, from: { opacity: 0, scale: 0.95, y: 30 } },

  // Type.
  { id: '1:10199', target: 'title', delay: 0.3, duration: 0.6, from: { opacity: 0, y: -15 } },
  { id: '1:10205', target: 'names', delay: 0.5, duration: 0.6, from: { opacity: 0 } },
  { id: '1:10203', target: 'closer', delay: 0.8, duration: 0.7, from: { opacity: 0, y: 10 } },

  // Desk oddments.
  { id: '1:10198', target: 'binder-clip', delay: 0.5, duration: 0.5, from: { opacity: 0, scale: 0.85 } },
  { id: '1:10201', target: 'washi-tape', delay: 0.6, duration: 0.5, from: { opacity: 0, scale: 0.85 } },
  { id: '1:10202', target: 'heart-cookie', delay: 0.7, duration: 0.5, from: { opacity: 0, scale: 0.85 } },
  { id: '1:10204', target: 'push-pin', delay: 0.8, duration: 0.5, from: { opacity: 0, scale: 0.85 } },
  { id: '1:10200', target: 'paper-clip', delay: 0.9, duration: 0.5, from: { opacity: 0, scale: 0.85 } },
];
