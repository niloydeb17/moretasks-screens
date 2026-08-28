import type { Composition, SceneData } from './compositions';
import { carouselSeconds, MAX_CARDS } from '@/scenes/birthday/geometry';
import { MAX_PEOPLE as MAX_MVP_PEOPLE, totalSeconds as mvpSeconds } from '@/scenes/mvp/motion';
import { introSeconds as mvpIntroSeconds } from '@/scenes/mvp/intro';
import { carouselSeconds as anniversarySeconds, MAX_PEOPLE as MAX_ANNIVERSARY_PEOPLE } from '@/scenes/anniversary/motion';
import { MAX_SCREENS } from '@/scenes/moments/geometry';
import { carouselSeconds as joineeSeconds, MAX_PEOPLE as MAX_JOINEES } from '@/scenes/new-joinee/motion';
import { totalSeconds as momentsSeconds } from '@/scenes/moments/motion';
import { MAX_TESTIMONIALS, totalSeconds as feedbackSeconds } from '@/scenes/feedback/motion';

/**
 * How many people a scene will actually show, clamped to what its rig supports.
 *
 * Each rig has its own ceiling — birthday's carousel has 16 card slots — so
 * clamping here (rather than at render time) keeps the duration and the scene
 * agreeing on the same count.
 */
export function personCount(data: SceneData, max: number): number {
  return Math.max(1, Math.min(data.people?.length ?? 1, max));
}

/**
 * A composition's frame count for a specific payload.
 *
 * Most scenes are a fixed length, so this just returns `durationInFrames`. The
 * two that cycle through people are the exception: their length depends on how
 * many share the occasion, and a static number would either cut a five-person
 * clip short or pad a one-person clip with dead air.
 */
export function resolveDurationInFrames(composition: Composition, data: SceneData): number {
  switch (composition.id) {
    case 'birthday':
      return Math.round(carouselSeconds(personCount(data, MAX_CARDS)) * composition.fps);
    // Plus the opening clip and wipe when they are switched on — without this
    // the composition would end mid-card, cut short by exactly the intro.
    case 'mvp': {
      const card = mvpSeconds(personCount(data, MAX_MVP_PEOPLE));
      const intro = data.intro ? mvpIntroSeconds(composition.fps) : 0;
      return Math.round((card + intro) * composition.fps);
    }
    case 'anniversary':
      return Math.round(anniversarySeconds(personCount(data, MAX_ANNIVERSARY_PEOPLE)) * composition.fps);
    // One strip, panning a card at a time, so the length follows the list —
    // and farewell shares that carousel, so both size themselves the same way.
    case 'new-joinee':
    case 'farewell':
      return Math.round(joineeSeconds(personCount(data, MAX_JOINEES)) * composition.fps);
    // Counted off `photos`, `achievements` and `quotes` rather than `people`:
    // this scene flies over a team's screens, not a list of celebrated people,
    // and an embedded card takes a stop just like a short does.
    // Each testimonial holds for as long as its own quote takes to read, so the
    // length follows the words rather than the card count — a wall of three
    // short notes is a much shorter clip than three long ones.
    case 'feedback': {
      const quotes = (data.testimonials?.length
        ? data.testimonials.map((t) => t.quote)
        : [data.message ?? '']
      ).slice(0, MAX_TESTIMONIALS);
      return Math.round(feedbackSeconds(quotes) * composition.fps);
    }
    case 'moments': {
      const authored = (data.achievements?.length ?? 0) + (data.quotes?.length ?? 0);
      const shorts = data.photos?.length ?? (authored > 0 ? 0 : 1);
      const screens = Math.max(1, Math.min(shorts + authored, MAX_SCREENS));
      return Math.round(momentsSeconds(screens) * composition.fps);
    }
    default:
      return composition.durationInFrames;
  }
}
