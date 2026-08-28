import type { ReactNode } from 'react';

/**
 * Strips all page chrome from the render route so a captured frame is exactly
 * the composition and nothing else — no margins, no scrollbars, and no
 * colour-scheme background bleeding in behind a scene.
 *
 * The centering below is inert during an actual capture: `scripts/render.mjs`
 * and `scripts/still.mjs` set the puppeteer viewport to the composition's exact
 * width/height, so there is no extra space to center into and the screenshot is
 * identical either way. It only matters when a person opens this route directly
 * in a normal browser window — without it the fixed-size composition sits
 * flush at the top-left with the forced black background filling the rest of a
 * wider window, which reads as broken rather than as a letterboxed preview.
 */
export default function RenderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html,body{margin:0;padding:0;overflow:hidden}
        body{background:#1a1a1a;min-height:100vh;display:flex;align-items:center;justify-content:center}
      `}</style>
      {children}
    </>
  );
}
