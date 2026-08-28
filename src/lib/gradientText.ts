import type { CSSProperties } from 'react';

/**
 * A Figma gradient fill on text, with stop positions given as fractions of the
 * TEXT LINE BOX (not of whatever element ends up painting it).
 */
export interface GradientSpec {
  angle: number;
  stops: readonly { color: string; at: number }[];
}

/** Extra background box above and below the line box, so descenders have
 *  something to be painted with. Comfortably clears Inter's descender at any
 *  size used across these scenes. */
const GLYPH_BLEED = 0.4;

/**
 * Text painted with a gradient — the only way CSS fills glyphs with one.
 *
 * `background-clip: text` paints glyphs with the element's background, so any
 * part of a glyph outside the background box gets nothing and renders
 * transparent. With `line-height` equal to `font-size` (which is what Figma
 * specifies for this project's gradient text) every descender falls outside
 * that box and disappears — the `y` in "Aryan" loses its tail.
 *
 * So the box is grown by `GLYPH_BLEED` and pulled back with a matching negative
 * margin, leaving layout untouched, and the gradient's stops are re-mapped from
 * line-box fractions into the taller box. Re-mapping (rather than just letting
 * the gradient stretch) is what keeps the colours landing exactly where Figma
 * puts them, and CSS clamps the end stops outward, so descenders inherit the
 * final colour just as they do in Figma.
 */
export function gradientTextStyle(gradient: GradientSpec, lineHeight: number): CSSProperties {
  const pad = Math.round(lineHeight * GLYPH_BLEED);
  const boxHeight = lineHeight + pad * 2;
  const stops = gradient.stops
    .map(({ color, at }) => `${color} ${(((pad + at * lineHeight) / boxHeight) * 100).toFixed(4)}%`)
    .join(', ');

  return {
    paddingTop: pad,
    paddingBottom: pad,
    marginTop: -pad,
    marginBottom: -pad,
    backgroundImage: `linear-gradient(${gradient.angle}deg, ${stops})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
}
