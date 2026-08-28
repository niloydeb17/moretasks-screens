/**
 * A CSS `cubic-bezier()` as a plain easing function.
 *
 * Figma exports its easing curves as cubic bezier control points, and GSAP accepts
 * any `(progress) => progress` function as an ease — so this is the bridge between
 * the two, with no approximation to a named GSAP ease and no extra plugin.
 *
 * Solves x(t) = x for t by Newton-Raphson, falling back to bisection where the
 * curve is too flat for Newton to converge (which is exactly what the near-vertical
 * start of an expo-out curve does). Same algorithm browsers use, so the result
 * matches what the design tool previewed.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  // Polynomial coefficients of the bezier with endpoints fixed at (0,0) and (1,1).
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const EPSILON = 1e-7;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < EPSILON) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < EPSILON) break;
      t -= error / slope;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 32 && high - low > EPSILON; i++) {
      const sampled = sampleX(t);
      if (Math.abs(sampled - x) < EPSILON) break;
      if (x > sampled) low = t;
      else high = t;
      t = low + (high - low) / 2;
    }
    return sampleY(t);
  };
}
