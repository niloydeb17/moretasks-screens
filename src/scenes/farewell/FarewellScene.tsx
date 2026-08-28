'use client';

import type { SceneProps } from '../birthday/BirthdayScene';
import NewJoineeScene from '../new-joinee/NewJoineeScene';
import { FAREWELL_VARIANT } from './geometry';

/**
 * "Farewell" — Figma node 6:2655 in file Yje5sXQV7QUDigZx08fs9A.
 *
 * The same card the new-joinee frame draws, in its goodbye variant. That is not
 * a shortcut taken for convenience: the two frames' plate, strip, glow boxes and
 * every type metric are identical to the last decimal, and only four things
 * differ — the eyebrow word, the heading, the glyph on the rule, and the lower
 * glow's starting colour. Those four live in `FAREWELL_VARIANT`; everything else
 * is shared, so a fix to the carousel lands in both frames at once instead of
 * only in whichever one someone remembered to touch.
 */
export default function FarewellScene({ data, frame, fps }: SceneProps) {
  return <NewJoineeScene data={data} frame={frame} fps={fps} variant={FAREWELL_VARIANT} />;
}
