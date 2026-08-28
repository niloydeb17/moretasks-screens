/**
 * "Quote" motion — Figma node 1:110, file Yje5sXQV7QUDigZx08fs9A.
 *
 * Read from the design's own keyframe tracks (`get_motion_context`), which
 * report one looping cohort of 5500ms across ten animated nodes.
 *
 * Unlike the other scenes here, these tracks do NOT collapse to a delay plus a
 * duration: several carry three, four, even thirteen keyframes with a different
 * easing on each segment, and the values return to where they started rather
 * than settling somewhere new. So the tracks are kept in the shape Figma
 * reports them — values, the fractional times they land on, and one easing per
 * segment — and expanded into tweens by the scene. Transcribing them into
 * hand-collapsed constants would lose exactly the information that makes this
 * an ambient drift rather than an entrance.
 *
 * Read this file as data, not logic. Each entry is one Figma node's one property.
 */

import { cubicBezier } from '@/lib/cubicBezier';

/** The cohort length Figma reports. The scene loops on this boundary. */
export const DURATION_SECONDS = 5.5;

/**
 * The easings Figma names on these tracks.
 *
 * `linear` and `easeInOut` are the CSS keywords it emits; `easeInOut` is CSS's
 * own `ease-in-out` curve. Anything else arrives as explicit control points.
 */
export type EaseSpec = 'linear' | 'easeInOut' | readonly [number, number, number, number];

const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);

/** Resolve a track's easing into something GSAP accepts. */
export function resolveEase(spec: EaseSpec): ((p: number) => number) | 'none' {
  if (spec === 'linear') return 'none';
  if (spec === 'easeInOut') return EASE_IN_OUT;
  return cubicBezier(spec[0], spec[1], spec[2], spec[3]);
}

/** A GSAP transform/opacity property name. */
export type MotionProp = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity';

export interface Track {
  /** Figma node id, for tracing a value back to the document. */
  id: string;
  /** `data-motion` value of the element it drives. */
  target: string;
  prop: MotionProp;
  /** Keyframe values, in order. `values[0]` is also the element's rest pose. */
  values: readonly number[];
  /** Where each value lands, as a fraction of the cohort. Same length as `values`. */
  times: readonly number[];
  /** One easing per segment, so `values.length - 1` of them. */
  eases: readonly EaseSpec[];
}

/**
 * Every track in the cohort.
 *
 * Grouped by the element they drive rather than by Figma's document order, so a
 * single element's behaviour reads together.
 */
export const TRACKS: readonly Track[] = [
  // Outlined circle — a slow breath: drifts up and right while dimming slightly.
  { id: '1:114', target: 'outline-circle', prop: 'opacity', values: [1, 0.85, 1], times: [0, 0.5, 1], eases: ['easeInOut', 'easeInOut'] },
  { id: '1:114', target: 'outline-circle', prop: 'x', values: [0, 5, 0, 0], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:114', target: 'outline-circle', prop: 'y', values: [0, -8, 0], times: [0, 0.5, 1], eases: ['easeInOut', 'easeInOut'] },

  // The orange group as a whole lifts, and the shape inside it also swells and
  // turns a few degrees — the two compose into one soft bloom.
  { id: '1:115', target: 'orange-group', prop: 'y', values: [0, -11.969, 0, 0], times: [0, 0.4091, 0.8182, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:116', target: 'orange-shape', prop: 'rotation', values: [180, 180, 175, 175], times: [0, 0.3607, 0.8182, 1], eases: ['linear', [0.5, 0, 0.5, 1], 'linear'] },
  { id: '1:116', target: 'orange-shape', prop: 'scaleX', values: [1, 1.03, 1, 1], times: [0, 0.4091, 0.8182, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:116', target: 'orange-shape', prop: 'scaleY', values: [-1, -1.03, -1, -1], times: [0, 0.4091, 0.8182, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:116', target: 'orange-shape', prop: 'x', values: [0, -16.004, 0, 0], times: [0, 0.3636, 0.7273, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:116', target: 'orange-shape', prop: 'y', values: [0, -37.499, -21.943, 0, 0], times: [0, 0.3636, 0.4091, 0.8182, 1], eases: ['linear', 'easeInOut', 'easeInOut', 'linear'] },

  // The yellow dot is the busiest track in the design: thirteen linear keyframes
  // walking it down and to the left across the orange shape.
  {
    id: '1:117', target: 'yellow-dot', prop: 'x',
    values: [0, 0, -3.699, -7.136, -28.957, -44.317, -53.196, -60.395, -58.609, -60.343, -65.515, -65.697, -65.697],
    times: [0, 0.3607, 0.3784, 0.3993, 0.4809, 0.5371, 0.5671, 0.6013, 0.6782, 0.7524, 0.8104, 0.8149, 1],
    eases: ['linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear'],
  },
  {
    id: '1:117', target: 'yellow-dot', prop: 'y',
    values: [31.489, 0.489, 4.507, 16.064, 18.594, 22.786, 26.549, 30.766, 38.871, 44.16, 45.489, 45.671, 45.671],
    times: [0, 0.362, 0.3784, 0.3993, 0.4809, 0.5371, 0.5671, 0.6013, 0.6782, 0.7524, 0.8104, 0.8149, 1],
    eases: ['linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear', 'linear'],
  },

  // The portrait rises and swells very slightly — the anchor of the collage, so
  // it moves least.
  { id: '1:118', target: 'portrait', prop: 'scaleX', values: [1, 1.02, 1, 1], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:118', target: 'portrait', prop: 'scaleY', values: [1, 1.02, 1, 1], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:118', target: 'portrait', prop: 'x', values: [0, 9.549, 0], times: [0, 0.5, 1], eases: ['easeInOut', 'easeInOut'] },
  { id: '1:118', target: 'portrait', prop: 'y', values: [0, -17.904, 0, 0], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },

  // Cyan circle — the widest travel of the three shapes.
  { id: '1:119', target: 'cyan-circle', prop: 'rotation', values: [0, -3, 0, 0], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:119', target: 'cyan-circle', prop: 'x', values: [0, -12, 0, 0], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:119', target: 'cyan-circle', prop: 'y', values: [0, -25, 0, 0], times: [0, 0.3636, 0.7273, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },

  // The quote bobs twice per loop — double the frequency of everything else,
  // which is what keeps the type feeling alive against the slow collage.
  { id: '1:122', target: 'quote-text', prop: 'y', values: [0, -8, 0, -8, 0], times: [0, 0.25, 0.5, 0.75, 1], eases: ['easeInOut', 'easeInOut', 'easeInOut', 'easeInOut'] },

  // The divider and attribution are the only true entrances: they arrive once,
  // early, and then hold for the rest of the loop.
  { id: '1:123', target: 'divider', prop: 'opacity', values: [0, 0, 1, 1], times: [0, 0.1091, 0.15, 1], eases: ['linear', [0.16, 1, 0.3, 1], 'linear'] },
  { id: '1:123', target: 'divider', prop: 'scaleX', values: [0.5, 0.5, 1, 1], times: [0, 0.1091, 0.1909, 1], eases: ['linear', [0.16, 1, 0.3, 1], 'linear'] },
  { id: '1:123', target: 'divider', prop: 'scaleY', values: [0.5, 0.5, 1, 1], times: [0, 0.1091, 0.1909, 1], eases: ['linear', [0.16, 1, 0.3, 1], 'linear'] },
  { id: '1:128', target: 'attribution', prop: 'opacity', values: [0, 1, 1], times: [0, 0.2182, 1], eases: [[0.25, 0.1, 0.25, 1], 'linear'] },
  { id: '1:128', target: 'attribution', prop: 'y', values: [12, 0, 0], times: [0, 0.2182, 1], eases: [[0.25, 0.1, 0.25, 1], 'linear'] },

  // The comma pair breathes with the collage.
  { id: '1:129', target: 'commas', prop: 'opacity', values: [0.18, 0.25, 0.18, 0.18], times: [0, 0.4545, 0.9091, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
  { id: '1:129', target: 'commas', prop: 'y', values: [0, -7.037, 0, 0], times: [0, 0.3818, 0.7636, 1], eases: ['easeInOut', 'easeInOut', 'linear'] },
];

/**
 * Each element's pose at time zero, gathered from the tracks that drive it.
 *
 * Written into the markup as inline style rather than set on the timeline: a
 * zero-duration tween parked at time 0 does not render when a paused timeline is
 * seeked to exactly 0, which would leave frame 0 showing every element at its
 * CSS default instead of its designed rest pose.
 */
export function restPose(target: string): Partial<Record<MotionProp, number>> {
  const pose: Partial<Record<MotionProp, number>> = {};
  for (const t of TRACKS) {
    if (t.target === target) pose[t.prop] = t.values[0];
  }
  return pose;
}

/** Every element the tracks address, in the order they first appear. */
export const MOTION_TARGETS = [...new Set(TRACKS.map((t) => t.target))];
