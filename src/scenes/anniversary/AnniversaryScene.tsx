'use client';

import type { SceneProps } from '../birthday/BirthdayScene';
import NewJoineeScene from '../new-joinee/NewJoineeScene';
import { variantForYears } from './card';

/**
 * "Work Anniversary" — Figma nodes 17:5113 (silver) and 26:5675 (gold) in file
 * Yje5sXQV7QUDigZx08fs9A.
 *
 * The same card the new-joinee and farewell frames draw, in its anniversary
 * palettes. That is measured rather than convenient: all four frames carry the
 * identical thirteen-slide strip — window x -569.72, slide 698.713 x 1053.054,
 * gap 61.651, step 760.364 — and the same header/footer skeleton. What the
 * anniversary frames change is palette, the glyph, the laurels either side of the
 * name, and a tenure where the joiner frames put a role. All of that lives in
 * `./card`; the rig is shared, so a fix to the carousel lands in all four frames
 * at once.
 *
 * Which palette is used follows the year count — silver for a first anniversary,
 * gold from the second on, which is the design's own split and what the panel's
 * experience toggle drives. The count is taken as the highest in the group,
 * because the palette is one plate for the whole clip: a silver first-
 * anniversary card would look wrong sitting between two gold ones on either
 * side of it. The eyebrow and heading are each person's own typed copy (see
 * `Person.eyebrowText`/`titleText` in `./card`), and turn over with the
 * carousel independently of which palette is showing.
 */
export default function AnniversaryScene({ data, frame, fps }: SceneProps) {
  const years = Math.max(
    1,
    ...(data.people?.length ? data.people.map((p) => p.years ?? 1) : [data.years ?? 1]),
  );

  return (
    <NewJoineeScene data={data} frame={frame} fps={fps} variant={variantForYears(years)} />
  );
}
