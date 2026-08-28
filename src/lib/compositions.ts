/**
 * Scene registry.
 *
 * Every scene is a fixed-size, fixed-duration composition. The renderer walks
 * `durationInFrames` and captures one PNG per frame, so these numbers are the
 * contract between the browser preview and the headless capture — changing them
 * changes the output video.
 */

/** Frame rate for every composition. Matches the Figma exports. */
export const FPS = 30;

export type SceneId =
  | 'birthday'
  | 'achievements'
  | 'photo-frame'
  | 'mvp'
  | 'new-joinee'
  | 'farewell'
  | 'anniversary'
  | 'moments'
  | 'quote'
  | 'feedback';

/** One celebrated person: the unit the birthday/anniversary carousels cycle through. */
export interface Person {
  name: string;
  photoUrl: string;
  subtitle: string;
  /** Completed years — anniversary's own per-person field, unused elsewhere. */
  years?: number;
  /**
   * The small label above the heading, and the heading itself — anniversary's
   * own per-person fields, unused elsewhere. Each falls back to the card
   * variant's own default text (see `SILVER_ANNIVERSARY`/`GOLD_ANNIVERSARY`)
   * when absent, so a person with nothing typed still gets sensible wording.
   */
  eyebrowText?: string;
  titleText?: string;
}

/**
 * One achievements collage, embedded as a screen inside another scene.
 *
 * These are the four fields `AchievementsScene` actually reads, named for what
 * they are here rather than for the slots they occupy in the flat `SceneData`
 * shape — a scene that carries several of these cannot express them as
 * `name`/`subtitle`/`message` on one payload.
 */
export interface Achievement {
  /** Title line, set in the display serif. */
  title: string;
  /** The names line under it. */
  names: string;
  /** Closing message at the foot of the collage. */
  message: string;
  /**
   * The five collage photos, in the scene's own card order. A missing or empty
   * entry keeps that card's baked-in design asset, so a freshly added
   * achievement renders as the original Figma collage until it is edited.
   */
  photos: string[];
}

/**
 * One quote card, embedded as a screen inside another scene.
 *
 * Named for what the fields are rather than for the flat `SceneData` slots they
 * end up in, for the same reason as `Achievement`: a scene carrying several of
 * these cannot express them all on one payload.
 */
export interface Quote {
  /** The quote itself, set large and uppercase. */
  text: string;
  /** Who said it — rendered under the rule, e.g. "By Confucius". */
  writer: string;
  /** Their picture, cropped into the card's arch. Empty keeps the design's own. */
  photoUrl: string;
}

/** One entry on the feedback wall. */
export interface Testimonial {
  /** What they said. Newlines split it into the design's paragraphs. */
  quote: string;
  name: string;
  /** Their job title, under the name. */
  role: string;
  /** Their picture, on the turned orange card. Empty leaves the grey placeholder. */
  photoUrl: string;
}

/**
 * The content HR supplies. One shape across all scenes so the admin app has a
 * single form to render and the renderer has a single payload to pass through.
 */
export interface SceneData {
  /** Person's display name. */
  name: string;
  /** Absolute or app-relative URL to their photo. */
  photoUrl: string;
  /** Secondary caption: birth date for birthdays, role for joiners/farewells. */
  subtitle: string;
  /** Long-form copy for citation-style scenes (MVP). */
  message?: string;
  /**
   * The small label above the heading, for cards whose eyebrow is fixed per
   * card rather than per person (new joinee's "Welcome", farewell's "See You
   * Soon"). Anniversary's own per-person eyebrow lives on `Person.eyebrowText`
   * instead — this is only read when a variant's eyebrow is NOT tracking the
   * person, mirroring how `message` already overrides a fixed title.
   */
  eyebrow?: string;
  /** Per-slot photo overrides for multi-photo scenes (achievements' five
   *  polaroids), in that scene's own card order. A missing or empty entry keeps
   *  that slot's design default — this is additive, not required per scene. */
  photos?: string[];
  /**
   * Everyone sharing the occasion, for scenes that cycle through several people
   * (birthday's card carousel). Absent or empty means one person, taken from
   * `name`/`photoUrl`/`subtitle` above — so single-person callers never have to
   * know this field exists.
   */
  people?: Person[];
  /** Completed years, for anniversary's single-person fallback shape (see `people`). */
  years?: number;
  /**
   * Play MVP's opening clip and diamond wipe before the card (Figma 34:6268).
   *
   * Opt-in: absent or false renders the card alone, exactly as it always has.
   * Only MVP reads this — no other scene has an opening.
   */
  intro?: boolean;
  /**
   * Treat an uploaded MVP portrait to match the design's own: desaturated, and
   * framed head-and-shoulders instead of taking the design asset's fixed crop.
   *
   * Defaults to ON when absent — see `autoPhotoOn` in MvpScene for why that is
   * the safe default rather than a surprise.
   */
  autoPhoto?: boolean;
  /**
   * Achievements collages to show as their own screens, for scenes that embed
   * other templates rather than only photos (moments' wall). Absent or empty
   * means none — no scene requires this.
   */
  achievements?: Achievement[];
  /**
   * Quote cards to show as their own screens, alongside `achievements`. Absent
   * or empty means none.
   */
  quotes?: Quote[];
  /**
   * The feedback wall's testimonials, panned one at a time. Absent or empty
   * falls back to one card built from `message`/`name`/`subtitle`.
   */
  testimonials?: Testimonial[];
}

export interface Composition {
  id: SceneId;
  label: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  defaults: SceneData;
}

/**
 * Five placeholder people sharing a 1-year milestone, reusing the
 * achievements scene's stock photos. This is what an unconfigured
 * anniversary render shows: the carousel panning through a different name,
 * photo, and badge per person, so the demo shows off the multi-person
 * carousel HR will actually configure rather than one static card.
 */
/**
 * The rosters below are July/August 2026's actual newsletter data, entered so an
 * unconfigured render is the real month rather than placeholders. Photos are
 * left empty on purpose — each card falls back to its own blank slide, and the
 * pictures get added by hand in the panel.
 */

/** August birthdays — only the ones flagged for a card, not the whole month. */
const AUGUST_BIRTHDAYS: Person[] = [
  { name: 'Ravi Shankar', photoUrl: '', subtitle: '19 Aug' },
  { name: 'Shiv Kumar', photoUrl: '', subtitle: '20 Aug' },
  { name: 'Vishal Yadav', photoUrl: '', subtitle: '24 Aug' },
  { name: 'Utkarsh Gupta', photoUrl: '', subtitle: '28 Aug' },
  { name: 'Atul Bisht', photoUrl: '', subtitle: '28 Aug' },
  { name: 'Nandini Bhardwaj', photoUrl: '', subtitle: '29 Aug' },
];

/**
 * August work anniversaries.
 *
 * Note the mixed tenures. The card's palette is one plate for the whole clip, so
 * any list containing more than a first anniversary renders gold throughout —
 * see `variantForYears`. Putting Shivani's first anniversary on its own silver
 * render is a panel action, not a data one.
 */
const AUGUST_ANNIVERSARIES: Person[] = [
  { name: 'Shivani Pandey', photoUrl: '', subtitle: '', years: 1, titleText: 'One Year Together' },
  { name: 'Abhishek Gupta', photoUrl: '', subtitle: '', years: 2, titleText: 'MoreTasks Growth Club' },
  { name: 'Major Singh Dhillon', photoUrl: '', subtitle: '', years: 2, titleText: 'MoreTasks Growth Club' },
  { name: 'Manish Yadav', photoUrl: '', subtitle: '', years: 5, titleText: 'MoreTasks Legacy Club' },
];

/** July's leavers, in the newsletter's own order (latest last working day first). */
const JULY_LEAVERS: Person[] = [
  { name: 'Akash Verma', photoUrl: '', subtitle: 'Booking' },
  { name: 'Dilip', photoUrl: '/assets/farewell/dilip.webp', subtitle: 'Booking' },
  { name: 'Keshav Kumar', photoUrl: '/assets/farewell/keshav-kumar.webp', subtitle: 'Booking' },
  { name: 'Nikhil Chabbra', photoUrl: '/assets/farewell/nikhil-chabbra.webp', subtitle: 'Supply Ops' },
  { name: 'Eshika Panwar', photoUrl: '/assets/farewell/eshika-panwar.webp', subtitle: 'Supply Ops' },
  { name: 'Rubi Devi', photoUrl: '/assets/farewell/rubi-devi.webp', subtitle: 'CS' },
  { name: 'Kushagra Kudesia', photoUrl: '/assets/farewell/kushagra-kudesia.webp', subtitle: 'CS' },
  { name: 'Anand Prakash', photoUrl: '/assets/farewell/anand-prakash.webp', subtitle: 'CS' },
  { name: 'Vijay Bohra', photoUrl: '/assets/farewell/vijay-bohra.webp', subtitle: 'CS' },
  { name: 'Ketan Mathur', photoUrl: '/assets/farewell/ketan-mathur.webp', subtitle: 'Supply Ops' },
  { name: 'Naveen Dagar', photoUrl: '/assets/farewell/naveen-dagar.webp', subtitle: 'Supply Ops' },
  { name: 'Sariga A', photoUrl: '/assets/farewell/sariga-a.webp', subtitle: 'Operations - Ecom' },
  { name: 'Imran Husain', photoUrl: '/assets/farewell/imran-husain.webp', subtitle: 'CS' },
  { name: 'Lavi Mallik', photoUrl: '', subtitle: 'CS' },
];

/** August's new joiners. */
const AUGUST_JOINEES: Person[] = [
  { name: 'Tanya Rawat', photoUrl: '', subtitle: 'Supply Ops' },
  { name: 'Atul Sharma', photoUrl: '', subtitle: 'Digital - Holy India' },
];

export const COMPOSITIONS = {
  birthday: {
    id: 'birthday',
    label: 'Birthday',
    width: 1080,
    height: 1920,
    fps: FPS,
    // 7.8s — the duration Figma reported for this frame's export.
    durationInFrames: 234,
    defaults: {
      name: 'Ravi Shankar',
      photoUrl: '',
      subtitle: '19 Aug',
      people: AUGUST_BIRTHDAYS,
    },
  },
  achievements: {
    id: 'achievements',
    label: 'Personal Achievements & Desk Diaries',
    width: 1080,
    height: 1920,
    fps: FPS,
    // 24.012s — the cohort Figma reports for the revised frame (node 3:147).
    // The collage's entrance is over inside the first 1.5s; the rest is the
    // cloud plate's 2829.5px pan, which is what sets the loop length.
    durationInFrames: 720,
    defaults: {
      name: 'NEW OFFICE',
      // Unused by this scene — the collage's five photos are overridden (if at
      // all) via `photos`, not `photoUrl`. Kept populated only because every
      // scene shares one data shape.
      photoUrl: '/assets/achievements/photo-1.webp',
      // Left unset on purpose: an absent `photos` array means every card falls
      // back to its own baked-in design asset, so an unconfigured render is
      // pixel-identical to the original design.
      subtitle: 'Kirti Adhikari, Rohit Suryavanshi, Shivani Pandey',
      message: 'Memories that stays forever',
    },
  },
  mvp: {
    id: 'mvp',
    label: 'Most Valuable Player',
    width: 1080,
    height: 1920,
    fps: FPS,
    // 49.23735s — Figma reports this frame as one looping cohort of that length.
    // Everything lands in the first ~1.2s; the rest is the starburst's single
    // slow revolution, which is the design, not padding.
    durationInFrames: 1477,
    defaults: {
      name: 'Bikash Mahto',
      photoUrl: '/assets/mvp/photo.webp',
      // `subtitle` is the awardee's role — the same slot `Person.subtitle`
      // fills for each entry when several people share the award.
      subtitle: 'Facilities Head',
      // `message` is the award line above the name, shared by every awardee.
      message: 'Most Valuable Player',
    },
  },
  anniversary: {
    id: 'anniversary',
    label: 'Work Anniversary',
    width: 1080,
    height: 1920,
    fps: FPS,
    // 71.2s for the full 13-photo carousel (1s hold + 12 x 4.850077s Gentle
    // pans) — the exact reaction chain from the reference component, node
    // 1:18219. A shorter `people` list plays a shorter carousel; see
    // `resolveDurationInFrames`.
    durationInFrames: 2136,
    defaults: {
      // Unused by this scene when `people` is set (it is, by default, below)
      // — kept populated only because every scene shares one data shape.
      name: 'Shivani Pandey',
      photoUrl: '',
      subtitle: '',
      years: 1,
      people: AUGUST_ANNIVERSARIES,
    },
  },
  farewell: {
    id: 'farewell',
    label: 'Farewell',
    width: 1080,
    height: 1920,
    fps: FPS,
    // Same carousel as new-joinee, so the same five-person default length; the
    // real value grows with the list — see `resolveDurationInFrames`.
    durationInFrames: 732,
    defaults: {
      name: 'Akash Verma',
      photoUrl: '',
      subtitle: 'Booking',
      // The heading above the strip.
      message: 'UNTIL WE MEET AGAIN',
      people: JULY_LEAVERS,
    },
  },
  'new-joinee': {
    id: 'new-joinee',
    label: 'New Joinees',
    width: 1080,
    height: 1920,
    fps: FPS,
    // Figma reports a 2000ms cohort for this frame but states no keyframes for
    // it; the length that matters is the carousel's, which grows with the
    // payload — see `resolveDurationInFrames`. This static value is the
    // five-joinee default below.
    durationInFrames: 732,
    defaults: {
      // Unused when `people` is set (it is, below) — kept populated because
      // every scene shares one data shape.
      name: 'Tanya Rawat',
      photoUrl: '',
      subtitle: 'Supply Ops',
      // The heading above the strip.
      message: 'NICE TO MEET YOU',
      people: AUGUST_JOINEES,
    },
  },
  feedback: {
    id: 'feedback',
    label: 'Feedback',
    width: 1080,
    height: 1920,
    fps: FPS,
    // Figma states no timing for this frame at all, and the real length is a
    // function of how long the quotes take to read, so this is only the value
    // for the three testimonials below — 20.0s + 17.7s + 16.0s of reading plus
    // two 1.1s pans. Edit the copy and `resolveDurationInFrames` recomputes it;
    // see `totalSeconds` in `feedback/motion`.
    durationInFrames: 1676,
    defaults: {
      /*
       * July's new-joiner feedback, verbatim from the newsletter.
       *
       * That table carries no job titles, only a join date, so the line under
       * each name is the date — it is the data that exists, and an empty line
       * there reads as broken rather than blank. Swap in real roles from the
       * panel if they matter more than the date.
       */
      name: 'Udit Yadav',
      subtitle: 'Joined 27 Jul 2026',
      photoUrl: '',
      message:
        'Thank you for reaching out and giving me the opportunity to share my feedback.\nMy experience at MoreTasks has been positive so far. I\'ve enjoyed learning new skills, especially in areas like data analysis and collaborating with the team. The work environment has been supportive, and I appreciate the guidance and opportunities to grow.\nOverall, I\'m grateful to be part of MoreTasks and look forward to learning and contributing even more. Thank you!',
      testimonials: [
        {
          quote:
            'Thank you for reaching out and giving me the opportunity to share my feedback.\nMy experience at MoreTasks has been positive so far. I\'ve enjoyed learning new skills, especially in areas like data analysis and collaborating with the team. The work environment has been supportive, and I appreciate the guidance and opportunities to grow.\nOverall, I\'m grateful to be part of MoreTasks and look forward to learning and contributing even more. Thank you!',
          name: 'Udit Yadav',
          role: 'Joined 27 Jul 2026',
          photoUrl: '',
        },
        {
          quote:
            'My experience with MoreTasks has been very positive so far. The overall journey has been smooth, and I particularly appreciate the supportive and friendly work environment. The workplace atmosphere is comfortable and positive, which makes the overall experience enjoyable.\nThe facilities provided at MoreTasks are also quite good and contribute to a comfortable working experience. I also appreciate the clear communication and the opportunities to learn through different tasks.\nOverall, I\'m happy with my experience at MoreTasks and look forward to continuing my journey with the team.',
          name: 'Md. Afsar Saifi',
          role: 'Joined 6 Jul 2026',
          photoUrl: '',
        },
        {
          quote:
            'really like the office environment as its really cool (in literal sense too) and the people of this office are really good and friendly and specially the food is also amazing\ntill date I have not faced any kind of problem because of clear and easy conversation access with everyone\nThus, I would say that my experience so far could not have been better!',
          name: 'Agam Rai',
          role: 'Joined 30 Jul 2026',
          photoUrl: '',
        },
        {
          quote:
            'It\'s been a month since I joined, and my experience so far has been really positive. I like the organization\'s culture and the discipline in the way things are managed and executed. The work environment has been welcoming, and I\'ve felt comfortable settling into my role.\nNandini has also been very supportive throughout this period. She has been approachable whenever I needed help and has made the onboarding and transition process much smoother.\nOverall, I\'m enjoying my experience here and looking forward to learning more and contributing to the team.\nThanks!',
          name: 'Jatin Bansal',
          role: 'Joined 1 Jul 2026',
          photoUrl: '',
        },
        {
          quote:
            'Interning at MoreTasks has been a genuinely valuable learning experience for me. Working on the Holy India project gave me hands-on exposure to real post-production workflows from cadencing and editing to collaborating closely with Udit on the editorial side.\nBeyond editing, I got to explore AI-assisted storyboarding and character sheet design from day one, which pushed me out of my comfort zone since visual communication wasn\'t originally my strong suit. Working with tools like ChatGPT for this taught me how AI workflows can genuinely speed up and support creative work.',
          name: 'Puneet Ohri',
          role: 'Joined 1 Jul 2026',
          photoUrl: '',
        },
      ],
    },
  },
  quote: {
    id: 'quote',
    label: 'Quote',
    width: 1080,
    height: 1920,
    fps: FPS,
    // 5.5s — Figma reports this frame as one looping 5500ms cohort across ten
    // animated nodes, so 165 frames is exactly one loop of the designed motion.
    durationInFrames: 165,
    defaults: {
      // The writer's name, under the rule.
      name: 'By Confucius',
      // Empty keeps the design's own portrait placeholder.
      photoUrl: '',
      subtitle: '',
      // The quote itself. `message` rather than `subtitle` so it matches the
      // long-form slot every other scene uses for body copy.
      message:
        'A man is great not because he hasn’t failed; A man is great because failure hasn’t stopped him.',
    },
  },
  moments: {
    id: 'moments',
    label: 'MoreTasks Highlights',
    width: 1080,
    height: 1920,
    fps: FPS,
    // Figma reports this frame as one looping 21.477s cohort, but that covers a
    // hand-built 132-tile placeholder wall. A real render lays one tile per
    // short, so the length follows the payload — see `resolveDurationInFrames`.
    // This static value is the five-short default below (49.45s), for callers
    // that never resolve it.
    durationInFrames: 1483,
    defaults: {
      // `name` is the word set large on the highlights card.
      name: 'Highlights',
      // The highlights card's artwork. Empty on purpose: the scene then draws
      // its own stand-in card, so an unconfigured render still opens on
      // something rather than a broken image.
      photoUrl: '',
      subtitle: '',
      // Five empty slots — five shorts laid out, none of their thumbnails
      // supplied yet. Each renders as a numbered placeholder tile, which is
      // what makes the wall's shape visible before any artwork exists.
      photos: ['', '', '', '', ''],
    },
  },
  'photo-frame': {
    id: 'photo-frame',
    label: 'Photo Frame',
    // Landscape, unlike every other composition — Figma sizes this frame 1920x1080.
    width: 1920,
    height: 1080,
    fps: FPS,
    // Figma defines no animation here (get_motion_context returns no nodes): the
    // window in the frame is filled by a real-time video feed downstream of this
    // app, not by anything this scene animates. 10s is an arbitrary but practical
    // loop length for a static backdrop, not a value Figma specified.
    durationInFrames: 300,
    defaults: {
      name: '',
      // Empty on purpose: an unset window renders Figma's own placeholder
      // checkerboard (see PhotoFrameScene), so the default matches the design.
      photoUrl: '',
      subtitle: '',
    },
  },
} as const satisfies Partial<Record<SceneId, Composition>>;

export type BuiltSceneId = keyof typeof COMPOSITIONS;

export function isBuiltScene(id: string): id is BuiltSceneId {
  return Object.prototype.hasOwnProperty.call(COMPOSITIONS, id);
}

export function getComposition(id: string): Composition | undefined {
  return isBuiltScene(id) ? COMPOSITIONS[id] : undefined;
}

export const BUILT_SCENES = Object.values(COMPOSITIONS) as Composition[];
