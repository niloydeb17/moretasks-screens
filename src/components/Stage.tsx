'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StageProps {
  width: number;
  height: number;
  children: ReactNode;
}

/**
 * Scales the fixed-size composition to fill whatever container it's placed in,
 * so a person previewing it never sees black bars — scaled up or down to cover
 * the container, cropping whichever edge overhangs on a container whose aspect
 * ratio doesn't match the composition's, and always centered regardless of how
 * the container's own size compares to the composition's.
 *
 * That last part matters: `/render/[scene]` places this directly under
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
 * the composition exactly, `scale` resolves to 1, and centering nets to zero —
 * this never changes a captured pixel.
 */
export default function Stage({ width, height, children }: StageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fit = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      setScale(Math.max(clientWidth / width, clientHeight / height));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

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
