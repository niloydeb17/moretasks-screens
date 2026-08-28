import type { CSSProperties } from 'react';

/**
 * Turning Figma's own node geometry into CSS, without re-deriving any of it.
 *
 * Figma hands out an affine matrix per node and a normalised crop rectangle per
 * image fill. Emitting those directly — rather than decomposing them into
 * rotate/scale/translate and re-composing in CSS — keeps mirrored nodes and
 * off-centre crops exact, and avoids accumulating rounding through trig we
 * would otherwise have to do ourselves.
 */

/**
 * A Figma `relativeTransform`: `[[m00, m01, m02], [m10, m11, m12]]`, mapping a
 * node-local point to its parent's space as
 * `x' = m00·x + m01·y + m02`, `y' = m10·x + m11·y + m12`.
 */
export type Transform = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
];

/**
 * Figma's affine matrix as a CSS `matrix()`.
 *
 * CSS `matrix(a,b,c,d,e,f)` maps `x' = a·x + c·y + e`, `y' = b·x + d·y + f`, so the
 * Figma rows transpose into `a=m00, b=m10, c=m01, d=m11, e=m02, f=m12`. A
 * mirrored node (negative determinant) comes through for free, which a
 * `rotate()` alone could not express.
 *
 * MUST be paired with `transform-origin: 0 0` — the matrix already places the
 * node's local origin, so any other origin would double-apply the offset.
 */
export function figmaMatrix(t: Transform): string {
  const [[m00, m01, m02], [m10, m11, m12]] = t;
  return `matrix(${m00}, ${m10}, ${m01}, ${m11}, ${m02}, ${m12})`;
}

/** Positions a node by its Figma matrix inside its parent. */
export function nodeStyle(t: Transform, w: number, h: number): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: w,
    height: h,
    transform: figmaMatrix(t),
    transformOrigin: '0 0',
  };
}

/** An image fill that covers its box, centred — Figma's `scaleMode: "FILL"`. */
export const COVER: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

/**
 * A Figma `scaleMode: "CROP"` fill, as CSS.
 *
 * The crop matrix `[[sx,_,tx],[_,sy,ty]]` says which normalised slice of the image
 * fills the box: x from `tx` to `tx+sx`, y from `ty` to `ty+sy`. So drawing the
 * whole image at `1/s` of the box size and pulling it back by `t/s` puts exactly
 * that slice in view — the parent clips the rest.
 */
export function cropStyle(t: Transform): CSSProperties {
  const sx = t[0][0];
  const tx = t[0][2];
  const sy = t[1][1];
  const ty = t[1][2];
  return {
    position: 'absolute',
    width: `${(100 / sx).toFixed(4)}%`,
    height: `${(100 / sy).toFixed(4)}%`,
    left: `${((-tx / sx) * 100).toFixed(4)}%`,
    top: `${((-ty / sy) * 100).toFixed(4)}%`,
    maxWidth: 'none',
    display: 'block',
  };
}
