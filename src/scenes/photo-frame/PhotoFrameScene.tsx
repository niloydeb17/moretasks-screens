/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import type { SceneData } from '@/lib/compositions';
import { BACKGROUND, CANVAS, WINDOW, WINDOW_BORDER } from './geometry';

export interface SceneProps {
  data: SceneData;
  /** Unused: Figma has no animated nodes on this frame (see geometry.ts). Kept
   *  so this scene satisfies the same `SCENES` component shape as every other. */
  frame: number;
  fps: number;
}

const CHECKERBOARD_TILE = 24;

/**
 * Figma's own "empty fill" convention, reproduced as CSS instead of an image.
 * Shown whenever the caller hasn't supplied a photo — i.e. exactly the state the
 * design was captured in — so an unconfigured render matches the source design
 * instead of silently showing a blank box.
 */
const CHECKERBOARD_STYLE = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'conic-gradient(#d9d9d9 90deg, transparent 90deg 180deg, #d9d9d9 180deg 270deg, transparent 270deg)',
  backgroundSize: `${CHECKERBOARD_TILE}px ${CHECKERBOARD_TILE}px`,
} as const;

export default function PhotoFrameScene({ data }: SceneProps) {
  return (
    <div style={{ position: 'relative', width: CANVAS.w, height: CANVAS.h, overflow: 'hidden' }}>
      <img
        src={BACKGROUND}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* The live-video/photo window. Real-time compositing happens downstream of
          this app; here it is a plain data-driven fill so an HR-configured photo
          renders faithfully, and an unconfigured one matches Figma's own
          placeholder rather than showing nothing. */}
      <div
        style={{
          position: 'absolute',
          left: WINDOW.x,
          top: WINDOW.y,
          width: WINDOW.w,
          height: WINDOW.h,
          border: `${WINDOW_BORDER.width}px solid ${WINDOW_BORDER.color}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...(data.photoUrl ? undefined : CHECKERBOARD_STYLE),
        }}
      >
        {data.photoUrl && (
          <img
            src={data.photoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>
    </div>
  );
}
