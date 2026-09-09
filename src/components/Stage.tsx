'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StageProps {
  width: number;
  height: number;
  /**
   * `'cover'` (the default) scales up to fill the container, cropping
   * whichever edge overhangs — right for a preview that should never show
   * black bars. `'contain'` scales down to fit entirely inside instead,
   * letterboxing rather than cropping.
   *
   * Only worth reaching for `'contain'` when the composition has off-centre
   * content a crop could plausibly cut off entirely rather than just trim —
   * see `page.tsx`'s use of this prop.
   */
  fit?: 'cover' | 'contain';
  children: ReactNode;
}

/**
 * Scales the fixed-size composition to fit whatever container it's placed in.
 * Scaled up or down and always centered, regardless of how the container's
 * own size compares to the composition's — see the `fit` prop for cover vs.
 * contain.
 *
 * Centering matters here: `/render/[scene]` places this directly under
 * `RenderLayout`, whose only child is this component, so its container is
 * exactly the page — but this is also used on preview pages where the
 * container is whatever's left of the window after a side panel, an arbitrary
 * size unrelated to `width`x`height`. Measuring the actual container (via
 * ResizeObserver) rather than `window.innerWidth/innerHeight`, and centering
 * with `top/left: 50%` + `translate(-50%, -50%)` rather than assuming the
 * container's center coincides with the composition's own, is what makes this
 * correct in both cases — the earlier version only worked when they happened
 * to be the same size, which silently broke on any narrower container.
 *
 * Inert during an actual capture: `scripts/render.mjs` / `scripts/still.mjs` set
 * the puppeteer viewport to exactly `width`x`height`, so the container matches
 * the composition exactly, `scale` resolves to 1 under either fit mode, and
 * centering nets to zero — this never changes a captured pixel.
 */
export default function Stage({ width, height, fit = 'cover', children }: StageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      const wRatio = clientWidth / width;
      const hRatio = clientHeight / height;
      setScale(fit === 'contain' ? Math.min(wRatio, hRatio) : Math.max(wRatio, hRatio));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height, fit]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width,
          height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
