/**
 * "New Joinees" geometry — Figma node 6:2529 in file Yje5sXQV7QUDigZx08fs9A.
 *
 * A welcome card: a teal gradient plate with a soft glow top and bottom, a
 * header block, and a horizontal strip of photo cards that pans one joinee at a
 * time. The joinee's name and role sit under the strip.
 *
 * The strip is the SAME rig the anniversary scene uses. That is not an
 * assumption — the numbers below were read from this frame's own nodes (6:2530 /
 * 6:2531) and they close on anniversary's to the last decimal: window x
 * -569.72, step 760.364, thirteen slides. They are restated here rather than
 * imported so each scene's geometry stays traceable to its own Figma node; if
 * they ever diverge in the file, they diverge here too.
 */

const ASSETS = '/assets/new-joinee';

export const CANVAS = { w: 1080, h: 1920 } as const;

/**
 * The carousel strip.
 *
 * `window` is the visible band; the strip inside it is what moves. `x` falls out
 * of the design centring a 2219.449-wide band on the 1080 canvas:
 * (1080 - 2219.449) / 2.
 */
export const STRIP = {
  window: { x: -569.7245, y: 448.9, w: 2219.449 },
  slideW: 698.713,
  slideH: 1053.054,
  gap: 61.651,
  /** `slideW + gap` — the auto-layout step between adjacent slides. */
  step: 760.364,
  count: 13,
} as const;

/**
 * The carousel's rhythm.
 *
 * Figma's motion export for this frame returns a 2000ms cohort with seven member
 * nodes and no keyframe values at all — every track comes back as
 * `initial={{}} animate={{}}`. The anniversary frame reports the same way, for
 * the same reason: the pan lives on the component set's own prototype reactions
 * rather than on a timeline. So these are anniversary's reaction values, which
 * is defensible precisely because the strip geometry proves it is the same rig.
 */
export const CAROUSEL = {
  holdSeconds: 1,
  durationSeconds: 4.850077152252197,
} as const;

/** Figma's "Gentle" Smart Animate preset, as spring constants. */
export const GENTLE_SPRING = { mass: 1, stiffness: 100, damping: 15 } as const;

/**
 * The two glows, one above the strip and one below.
 *
 * Both are plain ellipses with a gradient fill, so they are built in CSS rather
 * than loaded as the SVGs Figma exports. That is not a shortcut: those SVGs
 * carry the fill as a `gradientTransform` of `translate … rotate(90) scale(sx
 * sy)`, which does not survive being used as an `<img>` — the gradient rendered
 * well left of centre instead of on the canvas's midline. The values below are
 * the same numbers, expressed in a form the browser applies correctly.
 *
 * `top`'s gradient centre and radii come from unwinding that transform: the unit
 * circle is scaled to 503.762 x 1717.62, rotated 90 degrees (so those swap), and
 * landed at 972.349, 66.599 in the ellipse's own box.
 *
 * `bottom`'s gradient runs from y -98.142 to y 570.213 against a box only
 * 570.361 tall, so it starts above the box — hence the negative first stop,
 * which is what reproduces the design's already-part-way-along colour at the top
 * edge instead of starting from pure #01201E.
 */
export const GLOW = {
  w: 1944.697,
  h: 570.361,
  /** Only the boxes are shared; both fills come from the variant. */
  top: { y: -60.02 },
  bottom: { y: 1430.51 },
} as const;

/** Header block, above the strip. */
export const HEADER = {
  top: 73.66,
  width: 1185,
  /** Between the rule row, "Welcome", and the title group. */
  gap: 43,
  /** The rule. Its bar colours and the glyph inside it are per-variant. */
  rule: {
    width: 348,
    gap: 8,
    barHeight: 4,
    /** The glyph's container. Each variant places its own art inside this box. */
    iconBox: 64,
  },
  eyebrow: { fontSize: 40, weight: 600, letterSpacing: 1.2 },
  /** The title group: heading plus the divider under it. */
  group: { width: 997, gap: 50 },
  title: { fontSize: 78, weight: 700 },
} as const;

/**
 * What separates one card from another.
 *
 * Four frames share this one rig, and the evidence for that is geometric rather
 * than a guess: New Joinees (6:2529), Farewell (6:2655), and both anniversary
 * frames (17:5113 silver, 26:5675 gold) all carry the SAME thirteen-slide strip
 * — window x -569.72, slide 698.713 x 1053.054, gap 61.651, step 760.364 — and
 * the same header/footer skeleton, to the last decimal. What actually differs is
 * palette, the glyph, the wording, whether the footer's third line is a role or
 * a tenure, and the laurels the anniversary frames add either side of the name.
 *
 * So all of that lives here, one object per frame, and the scene reads from it.
 * Positions and type metrics stay in the constants above, because those are the
 * part the four frames genuinely share.
 */

/** What the header and footer read off a person. Structural, so the app's own
 * `Person` satisfies it without this file depending on the data layer. */
export interface CardPerson {
  name: string;
  subtitle: string;
  years?: number;
  /** Freeform per-person copy for the anniversary variants — see `Variant`. */
  eyebrowText?: string;
  titleText?: string;
}

/** Either a fixed string, or one derived from whoever is on screen. */
export type CardText = string | ((person: CardPerson) => string);

export interface Variant {
  /** The plate behind everything. Figma states the stops as canvas-height %. */
  plate: string;
  /** The upper glow's fill — a radial, with its transform already unwound. */
  topGlow: string;
  /** The lower glow's fill — see GLOW for why a stop can be negative. */
  bottomGlow: string;
  /** The rule flanking the glyph. */
  rule: { from: string; to: string };
  /** The glyph on the rule, placed inside `HEADER.rule.iconBox`. */
  icon: { src: string; x: number; y: number; w: number; h: number };
  /**
   * Small word above the heading. A function when it has to track the person —
   * the anniversary frames read "Celebrating 1st", and that ordinal is the
   * whole point of the field being allowed to vary.
   */
  eyebrow: CardText;
  eyebrowColor: string;
  /**
   * Heading, when the payload does not supply one. A function when it has to
   * track the person — the anniversary frames now take freeform per-person
   * copy here (see `Person.titleText`), so this crossfades with the carousel
   * exactly as `eyebrow` does.
   */
  title: CardText;
  /** Figma sets some headings in caps and others as typed. */
  titleUppercase: boolean;
  titleColor: string;
  /** The rule under the heading. */
  headerDivider: DividerTheme;
  /** The rule under the name. */
  footerDivider: DividerTheme;
  /** Where the footer block starts. The anniversary frames sit 10px lower. */
  footerTop: number;
  /**
   * Name and subline inks. A `linear-gradient(...)` is painted through the
   * glyphs rather than behind them; anything else is used as a flat colour.
   *
   * `subline` is optional: the joiner frames always have a role under the
   * name, but the anniversary frames were asked to drop that third line
   * entirely and stop at the name — see the note on `SILVER_ANNIVERSARY`.
   */
  nameFill: string;
  subline?: { text: CardText; fill: string; width?: number; lighten?: boolean };
  /** The laurels either side of the footer. Anniversary only. */
  laurels?: Laurels;
}

/**
 * The laurel pair flanking the anniversary footer (node 17:5131).
 *
 * One asset, used twice: Figma's two children are byte-identical apart from
 * their element ids, and the right one is the left flipped vertically and turned
 * to its own angle.
 *
 * BOTH angles are stated rather than deriving the right from the left, because
 * the obvious derivation is wrong. `rotate(x) scaleY(-1)` applies the flip
 * first, so the true mirror of `rotate(-9)` is not `rotate(-9 - 180)` — working
 * it through, mirroring about the vertical axis gives `rotate(189) scaleY(-1)`,
 * i.e. -171, which is exactly what Figma states. Deriving it cost 18 degrees of
 * asymmetry that was subtle enough to survive a glance at the render.
 *
 * `overlap` is the design's negative margin. It belongs to the LEFT laurel and
 * the name column only — not the right laurel. A trailing negative margin would
 * narrow the flex row without moving its right edge, which slides everything
 * inside it off the canvas's centre by half the value.
 */
export interface Laurels {
  src: string;
  w: number;
  h: number;
  innerW: number;
  innerH: number;
  rotation: { left: number; right: number };
  overlap: number;
  opacity: number;
}

/** "New Joinees" — Figma node 6:2529. */
export const WELCOME_VARIANT: Variant = {
  plate: 'linear-gradient(to bottom, #00847c 26.148%, #00201e 74.152%)',
  topGlow:
    'radial-gradient(1717.62px 503.762px at 972.349px 66.5994px, ' +
    '#ffffff 10.98%, #03B5AA 63.9%, #00847C 92.09%)',
  bottomGlow: 'linear-gradient(to bottom, #01201E -14.68%, #000000 100%)',
  rule: { from: '#006352', to: 'rgba(0, 99, 82, 0)' },
  icon: { src: `${ASSETS}/folded-hands.svg`, x: 0, y: 0, w: 64, h: 64 },
  eyebrow: 'Welcome',
  eyebrowColor: '#007561',
  title: 'NICE TO MEET YOU',
  titleUppercase: false,
  titleColor: '#005747',
  headerDivider: { from: '#006352', to: 'rgba(3, 106, 82, 0)', dot: '#006352' },
  footerDivider: { from: '#ffffff', to: 'rgba(255, 255, 255, 0)', dot: '#ffffff' },
  footerTop: 1536.66,
  nameFill: '#ffffff',
  subline: { text: (person) => person.subtitle, fill: '#d9d9d9', width: 354 },
};

/** Footer block, below the strip: the joinee's name and role. */
export const FOOTER = {
  gap: 38,
  name: { fontSize: 78, weight: 700 },
  /** The line under the name — a role, or a tenure. Fill is per-variant. */
  subline: { fontSize: 40, weight: 600 },
} as const;

/**
 * The small rule that sits under a heading — two bars fading outward from a
 * rotated square. Used twice, in the header's ink and again in white below.
 */
export const DIVIDER = {
  width: 250,
  gap: 8,
  barHeight: 4,
  dot: { box: 12.728, size: 9, rotation: -45 },
} as const;

/** One rule's inks: the bars fade from `from` to `to`, with `dot` between them. */
export interface DividerTheme {
  from: string;
  to: string;
  dot: string;
}
