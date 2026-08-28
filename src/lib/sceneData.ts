import type { Achievement, Person, Quote, SceneData, Testimonial } from './compositions';

/**
 * Scene data travels to the render surface in the URL, so the headless renderer
 * needs nothing but a URL to reproduce a frame. Kept as URI-encoded JSON rather
 * than base64 so a failing render is debuggable by reading the address bar.
 */
export const SCENE_DATA_PARAM = 'd';
export const FRAME_PARAM = 'frame';

export function encodeSceneData(data: SceneData): string {
  return encodeURIComponent(JSON.stringify(data));
}

/**
 * Decodes scene data, falling back to the composition defaults field-by-field.
 * A malformed or partial payload yields a renderable scene rather than a crash —
 * a broken render is far harder for HR to diagnose than a placeholder value.
 */
export function decodeSceneData(raw: string | undefined, fallback: SceneData): SceneData {
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const input = parsed as Record<string, unknown>;
  const str = (key: keyof SceneData, dflt: string) =>
    typeof input[key] === 'string' && (input[key] as string).length > 0
      ? (input[key] as string)
      : dflt;

  const photos =
    Array.isArray(input.photos) && input.photos.every((p) => typeof p === 'string')
      ? (input.photos as string[])
      : fallback.photos;

  // Each entry must be a whole person; a half-filled one would render a card
  // with a blank name or a missing photo, which is worse than falling back.
  const people =
    Array.isArray(input.people) &&
    input.people.every(
      (p): p is Person =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Person).name === 'string' &&
        typeof (p as Person).photoUrl === 'string' &&
        typeof (p as Person).subtitle === 'string',
    )
      ? (input.people as Person[])
      : fallback.people;

  // Same all-or-nothing rule as `people`: a half-formed entry would render a
  // collage with a blank title or a missing photo list, which is worse than
  // falling back to whatever the composition's defaults describe.
  const achievements =
    Array.isArray(input.achievements) &&
    input.achievements.every(
      (a): a is Achievement =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as Achievement).title === 'string' &&
        typeof (a as Achievement).names === 'string' &&
        typeof (a as Achievement).message === 'string' &&
        Array.isArray((a as Achievement).photos) &&
        (a as Achievement).photos.every((p) => typeof p === 'string'),
    )
      ? (input.achievements as Achievement[])
      : fallback.achievements;

  // Same all-or-nothing rule as `people` and `achievements`.
  const quotes =
    Array.isArray(input.quotes) &&
    input.quotes.every(
      (q): q is Quote =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as Quote).text === 'string' &&
        typeof (q as Quote).writer === 'string' &&
        typeof (q as Quote).photoUrl === 'string',
    )
      ? (input.quotes as Quote[])
      : fallback.quotes;

  // Same all-or-nothing rule as `people`: a half-formed testimonial would render
  // a card with an empty quote or a nameless face, which is worse than falling
  // back to whatever the composition's defaults describe.
  const testimonials =
    Array.isArray(input.testimonials) &&
    input.testimonials.every(
      (t): t is Testimonial =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as Testimonial).quote === 'string' &&
        typeof (t as Testimonial).name === 'string' &&
        typeof (t as Testimonial).role === 'string' &&
        typeof (t as Testimonial).photoUrl === 'string',
    )
      ? (input.testimonials as Testimonial[])
      : fallback.testimonials;

  return {
    name: str('name', fallback.name),
    photoUrl: str('photoUrl', fallback.photoUrl),
    subtitle: str('subtitle', fallback.subtitle),
    message: typeof input.message === 'string' ? input.message : fallback.message,
    eyebrow: typeof input.eyebrow === 'string' ? input.eyebrow : fallback.eyebrow,
    photos,
    people,
    years: typeof input.years === 'number' ? input.years : fallback.years,
    intro: typeof input.intro === 'boolean' ? input.intro : fallback.intro,
    autoPhoto: typeof input.autoPhoto === 'boolean' ? input.autoPhoto : fallback.autoPhoto,
    achievements,
    quotes,
    testimonials,
  };
}

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
