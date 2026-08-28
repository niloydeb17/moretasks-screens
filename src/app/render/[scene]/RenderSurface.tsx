'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Composition, SceneData } from '@/lib/compositions';
import { SCENES } from '@/scenes';
import Stage from '@/components/Stage';
import { seekRegisteredVideos, whenVideoReady } from '@/lib/videoSync';

declare global {
  interface Window {
    /** Seeks to a frame and resolves once that frame is on screen. */
    __seekToFrame?: (frame: number) => Promise<void>;
    /** True once fonts and images are loaded and the first frame is safe to capture. */
    __renderReady?: boolean;
  }
}

interface Props {
  composition: Composition;
  data: SceneData;
  initialFrame: number;
}

/**
 * The surface the headless renderer drives.
 *
 * Contract with `scripts/render.mjs`:
 *   1. wait for `html[data-render-ready="1"]` — fonts and images are settled
 *   2. `await window.__seekToFrame(n)` — resolves only after frame n has painted
 *   3. screenshot
 *
 * Step 2 is the important one. Awaiting an actual paint (rather than sleeping a
 * fixed number of milliseconds) is what keeps capture exact: no frame is ever
 * grabbed mid-update, so the video cannot tear or drop a frame under load.
 */
export default function RenderSurface({ composition, data, initialFrame }: Props) {
  const Scene = SCENES[composition.id as keyof typeof SCENES];

  const [frame, setFrame] = useState(initialFrame);
  const frameRef = useRef(initialFrame);
  const pendingResolve = useRef<(() => void) | null>(null);

  useEffect(() => {
    window.__seekToFrame = async (next: number) => {
      // Video backgrounds are decoded before React re-renders, so the frame the
      // screenshot lands on already has the right footage behind it. Doing this
      // first (rather than reacting to the state change) is what keeps the
      // capture from racing an in-flight seek.
      await seekRegisteredVideos(next);

      return new Promise<void>((resolve) => {
        // Re-seeking to the current frame produces no re-render, so React would
        // never fire the effect below and the promise would hang forever.
        if (next === frameRef.current) {
          requestAnimationFrame(() => resolve());
          return;
        }
        pendingResolve.current = resolve;
        frameRef.current = next;
        setFrame(next);
      });
    };

    return () => {
      delete window.__seekToFrame;
    };
  }, []);

  // Child layout effects (the scene's `seek`) flush before the parent's, so by
  // the time this runs the new frame is in the DOM. Two rAFs then guarantee it
  // has actually been painted before the screenshot is taken.
  useLayoutEffect(() => {
    const resolve = pendingResolve.current;
    if (!resolve) return;
    pendingResolve.current = null;
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }, [frame]);

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      window.__renderReady = true;
      document.documentElement.dataset.renderReady = '1';
    };

    void (async () => {
      try {
        await document.fonts.ready;
        // Videos need enough decoded data that a seek will actually paint;
        // without this the opening frames can capture an empty <video> box.
        await Promise.all(Array.from(document.querySelectorAll('video'), whenVideoReady));
        await Promise.all(
          Array.from(document.images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  // A missing photo must not stall the render — the scene has a
                  // fallback, and a hung render is far worse than a visible gap.
                  img.addEventListener('error', () => resolve(), { once: true });
                }),
          ),
        );
      } finally {
        markReady();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stage width={composition.width} height={composition.height}>
      <Scene data={data} frame={frame} fps={composition.fps} />
    </Stage>
  );
}
