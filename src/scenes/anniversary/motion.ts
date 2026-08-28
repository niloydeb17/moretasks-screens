/**
 * "Work Anniversary" motion.
 *
 * The anniversary frames run the same carousel as the new-joinee and farewell
 * ones — same strip geometry to the last decimal, same 1s hold and 4.85s
 * "Gentle" pan — so the timing lives in one place and this module re-exports it
 * rather than restating values that would then be free to drift apart.
 *
 * These two names are the module's public surface: `src/lib/duration.ts` sizes
 * the anniversary composition with them, and `src/app/page.tsx` caps its people
 * list with `MAX_PEOPLE`.
 */

export { MAX_PEOPLE, carouselSeconds } from '../new-joinee/motion';
