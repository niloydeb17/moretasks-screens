'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export type TimelineBuilder = (
  tl: gsap.core.Timeline,
  root: HTMLElement,
) => void;

/**
 * Builds a paused GSAP timeline once, then drives it purely by seeking.
 *
 * THE RULE: the timeline is never played. Time advances only through
 * `seek(frame / fps)`. This is what makes a frame reproducible — frame 90 is
 * identical pixels in HR's browser preview and in the headless capture, so what
 * HR approves is exactly what renders.
 *
 * Calling `.play()`, `.resume()`, or using a CSS transition/animation inside a
 * scene breaks this: the headless renderer would race the animation, landing
 * frames at uneven intervals and producing jittery, non-reproducible video.
 * `npm run verify:determinism` renders the same input twice and compares, which
 * is the guard against that regression.
 *
 * `build` must be referentially stable (wrap it in `useCallback`), otherwise the
 * timeline is torn down and rebuilt on every render.
 */
export function useSeekTimeline(
  build: TimelineBuilder,
  frame: number,
  fps: number,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // gsap.context scopes selector strings to this root and makes cleanup total,
    // so a rebuild cannot leave stale tweens mutating the DOM.
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true });
      build(tl, root);
      timelineRef.current = tl;
    }, root);

    return () => {
      ctx.revert();
      timelineRef.current = null;
    };
  }, [build]);

  // Depends on `build` too: after a rebuild the timeline sits at 0, so it must
  // be re-seeked to the current frame or the scene would flash back to its
  // opening state.
  useLayoutEffect(() => {
    timelineRef.current?.seek(frame / fps, true);
  }, [frame, fps, build]);

  return rootRef;
}
