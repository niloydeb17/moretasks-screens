'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, type CSSProperties } from 'react';
import type { Person, SceneData } from '@/lib/compositions';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import type { SceneProps } from '../birthday/BirthdayScene';
import {
  CANVAS,
  CAROUSEL,
  DIVIDER,
  FOOTER,
  GLOW,
  HEADER,
  STRIP,
  WELCOME_VARIANT,
  type CardPerson,
  type CardText,
  type DividerTheme,
  type Laurels,
  type Variant,
} from './geometry';
import {
  EASE_OUT_EXPO,
  ENTRANCE,
  GENTLE_EASE,
  NAME_BLOCK_ENTRANCE_DELAY,
  NAME_CROSSFADE_SECONDS,
  personCount,
} from './motion';

const SANS = 'var(--font-inter), sans-serif';

/** A variant's text, resolved against whoever is currently on screen. */
function resolve(text: CardText, person: CardPerson): string {
  return typeof text === 'function' ? text(person) : text;
}

/**
 * An ink, as type styling.
 *
 * The gold anniversary frame paints its name and tenure with gradients rather
 * than flat colours, which means running the gradient THROUGH the glyphs —
 * `background-clip: text` over a transparent fill — instead of behind them.
 * Anything that is not a gradient is just a colour, which is every other frame.
 */
function textFill(fill: string): CSSProperties {
  if (!fill.startsWith('linear-gradient')) return { color: fill };
  return {
    backgroundImage: fill,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
}

/**
 * The joinees this render pans through.
 *
 * `people` is the multi-person path; a caller that only knows about one still
 * gets a valid single-card strip out of the flat name/photo/subtitle fields.
 */
function resolvePeople(data: SceneData): Person[] {
  const list = data.people?.length
    ? data.people
    : [
        {
          name: data.name,
          photoUrl: data.photoUrl,
          subtitle: data.subtitle,
          // Carried through for the anniversary variants, which read the year
          // off the person; the joiner variants ignore it.
          years: data.years,
        },
      ];
  return list.slice(0, personCount(data.people?.length ?? 1));
}

/** One card in the strip. Blank white until a photo is supplied, as Figma draws it. */
function Slide({ index, person }: { index: number; person: Person | null }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: index * STRIP.step,
        top: 0,
        width: STRIP.slideW,
        height: STRIP.slideH,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {person?.photoUrl ? (
        <img
          src={person.photoUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : null}
    </div>
  );
}

/** Two bars fading outward from a rotated square. Used in both inks. */
function Divider({ theme }: { theme: DividerTheme }) {
  const bar = (dir: 'left' | 'right'): CSSProperties => ({
    flex: '1 0 0',
    minWidth: 1,
    height: DIVIDER.barHeight,
    background: `linear-gradient(to ${dir}, ${theme.from}, ${theme.to})`,
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DIVIDER.gap,
        width: DIVIDER.width,
        flexShrink: 0,
      }}
    >
      <div style={bar('left')} />
      <div
        style={{
          width: DIVIDER.dot.box,
          height: DIVIDER.dot.box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: DIVIDER.dot.size,
            height: DIVIDER.dot.size,
            background: theme.dot,
            transform: `rotate(${DIVIDER.dot.rotation}deg)`,
          }}
        />
      </div>
      <div style={bar('right')} />
    </div>
  );
}

/**
 * One laurel, for the anniversary frames' footer.
 *
 * The design's two are the same artwork used twice: the right one is the left
 * rotated to -171 degrees and flipped vertically. So one asset is loaded and the
 * side decides the transform, rather than shipping a mirrored copy.
 */
function Laurel({ spec, side }: { spec: Laurels; side: 'left' | 'right' }) {
  return (
    <div
      style={{
        position: 'relative',
        width: spec.w,
        height: spec.h,
        flexShrink: 0,
        opacity: spec.opacity,
        // Figma's negative margin sits on the left laurel and the name column,
        // and NOT on the right one — a trailing negative margin narrows the row
        // without moving its right edge, which slides everything inside it off
        // the canvas's centre by half the value.
        marginRight: side === 'left' ? spec.overlap : 0,
        // The flip is applied before the turn, so the right angle is stated in
        // the spec rather than derived from the left. See `Laurels`.
        transform:
          side === 'left'
            ? `rotate(${spec.rotation.left}deg)`
            : `rotate(${spec.rotation.right}deg) scaleY(-1)`,
      }}
    >
      <img
        src={spec.src}
        alt=""
        style={{
          position: 'absolute',
          left: (spec.w - spec.innerW) / 2,
          top: (spec.h - spec.innerH) / 2,
          width: spec.innerW,
          height: spec.innerH,
          display: 'block',
        }}
      />
    </div>
  );
}

/**
 * The shared celebration card.
 *
 * Four Figma frames are this one scene — New Joinees, Farewell, and both
 * anniversary frames. See `Variant` in ./geometry for what actually differs
 * between them, and why it is parameterised rather than copied four times.
 */
export default function NewJoineeScene({
  data,
  frame,
  fps,
  variant = WELCOME_VARIANT,
}: SceneProps & { variant?: Variant }) {
  const people = resolvePeople(data);
  const count = people.length;

  /**
   * The eyebrow, and how many of them get rendered.
   *
   * Fixed on the joiner frames — "Welcome", "GoodBye" — so one element and no
   * crossfade. The anniversary frames read "Celebrating 1st", which names the
   * year the person on screen is actually on, so there it becomes one element
   * per person, faded across on the same schedule as the name below.
   */
  const eyebrowTracksPerson = typeof variant.eyebrow === 'function';
  const eyebrows = eyebrowTracksPerson ? people : people.slice(0, 1);

  /** Same crossfade, for the heading — see `titleTracksPerson`'s note above. */
  const titleTracksPerson = typeof variant.title === 'function';
  const titles = titleTracksPerson ? people : people.slice(0, 1);

  /**
   * Slots the strip actually renders.
   *
   * Person 0 sits at slot 1, not slot 0: the window is centred such that the
   * slide one step in is the one on screen at rest, so putting them at slot 1 is
   * what makes *them* the joinee being welcomed when the loop opens. Slots 0 and
   * `count + 1` wrap the list around so the pan never reveals empty plate.
   */
  const slots: (Person | null)[] = [
    people[count - 1] ?? null,
    ...people,
    people[0] ?? null,
  ];

  const build = useCallback<TimelineBuilder>(
    (tl) => {
      // Header and strip rise in, staggered top to bottom so the eye follows
      // the reading order.
      ENTRANCE.groups.forEach((group, i) => {
        tl.from(
          `[data-motion="${group}"]`,
          {
            opacity: 0,
            y: ENTRANCE.riseDistance,
            duration: ENTRANCE.duration,
            ease: EASE_OUT_EXPO,
          },
          i * ENTRANCE.stagger,
        );
      });

      // The first joinee's name block follows the strip in.
      tl.from(
        '[data-motion="name-0"]',
        {
          opacity: 0,
          y: ENTRANCE.riseDistance,
          duration: ENTRANCE.duration,
          ease: EASE_OUT_EXPO,
        },
        NAME_BLOCK_ENTRANCE_DELAY,
      );

      // The carousel: hold on a joinee, pan to the next, repeat. One pan per gap
      // between people, so a single joinee never moves.
      for (let step = 0; step < count - 1; step += 1) {
        const at = CAROUSEL.holdSeconds * (step + 1) + CAROUSEL.durationSeconds * step;

        tl.to(
          '[data-motion="strip"]',
          {
            x: -(step + 1) * STRIP.step,
            duration: CAROUSEL.durationSeconds,
            ease: GENTLE_EASE,
          },
          at,
        );

        // The name has to change while the strip is moving, or it would still be
        // reading the previous joinee once the next card lands.
        tl.to(
          `[data-motion="name-${step}"]`,
          { opacity: 0, duration: NAME_CROSSFADE_SECONDS, ease: 'none' },
          at,
        );
        tl.fromTo(
          `[data-motion="name-${step + 1}"]`,
          { opacity: 0 },
          { opacity: 1, duration: NAME_CROSSFADE_SECONDS, ease: 'none', immediateRender: false },
          at,
        );

        // The anniversary eyebrow and title are per-person copy, so they have to
        // turn over with the person — on the same beat, or the card would
        // briefly show text describing whoever is already sliding away.
        if (eyebrowTracksPerson) {
          tl.to(
            `[data-motion="eyebrow-${step}"]`,
            { opacity: 0, duration: NAME_CROSSFADE_SECONDS, ease: 'none' },
            at,
          );
          tl.fromTo(
            `[data-motion="eyebrow-${step + 1}"]`,
            { opacity: 0 },
            { opacity: 1, duration: NAME_CROSSFADE_SECONDS, ease: 'none', immediateRender: false },
            at,
          );
        }
        if (titleTracksPerson) {
          tl.to(
            `[data-motion="title-${step}"]`,
            { opacity: 0, duration: NAME_CROSSFADE_SECONDS, ease: 'none' },
            at,
          );
          tl.fromTo(
            `[data-motion="title-${step + 1}"]`,
            { opacity: 0 },
            { opacity: 1, duration: NAME_CROSSFADE_SECONDS, ease: 'none', immediateRender: false },
            at,
          );
        }
      }
    },
    [count, eyebrowTracksPerson, titleTracksPerson],
  );

  const rootRef = useSeekTimeline(build, frame, fps);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: CANVAS.w,
        height: CANVAS.h,
        overflow: 'hidden',
        background: variant.plate,
        fontFamily: SANS,
      }}
    >
      {/* ---- the strip ---- */}
      <div
        data-motion="strip-window"
        style={{
          position: 'absolute',
          left: STRIP.window.x,
          top: STRIP.window.y,
          width: STRIP.window.w,
          height: STRIP.slideH,
        }}
      >
        <div data-motion="strip" style={{ position: 'absolute', left: 0, top: 0 }}>
          {slots.map((person, i) => (
            <Slide key={i} index={i} person={person} />
          ))}
        </div>
      </div>

      {/* The glows sit OVER the strip, not behind it — that is Figma's own
          z-order (strip, then both ellipses, then the type), and it is what makes
          the cards fade into the plate at their top and bottom edges rather than
          ending on a hard line. Both share one entrance group: they read as a
          single wash. */}
      <div data-motion="glow" style={{ position: 'absolute', inset: 0 }}>
        {[
          { y: GLOW.top.y, fill: variant.topGlow },
          { y: GLOW.bottom.y, fill: variant.bottomGlow },
        ].map((g) => (
          <div
            key={g.y}
            style={{
              position: 'absolute',
              left: (CANVAS.w - GLOW.w) / 2,
              top: g.y,
              width: GLOW.w,
              height: GLOW.h,
              borderRadius: '50%',
              background: g.fill,
            }}
          />
        ))}
      </div>

      {/* ---- header ---- */}
      <div
        style={{
          position: 'absolute',
          left: (CANVAS.w - HEADER.width) / 2,
          top: HEADER.top,
          width: HEADER.width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: HEADER.gap,
        }}
      >
        <div
          data-motion="rule"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: HEADER.rule.gap,
            width: HEADER.rule.width,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: '1 0 0',
              minWidth: 1,
              height: HEADER.rule.barHeight,
              background: `linear-gradient(to left, ${variant.rule.from}, ${variant.rule.to})`,
            }}
          />
          {/* The glyph sits inside a fixed 64px box; Figma insets the artwork
              within it differently per variant, so the box is what keeps the
              rule's own length identical across both. */}
          <div
            style={{
              position: 'relative',
              width: HEADER.rule.iconBox,
              height: HEADER.rule.iconBox,
              flexShrink: 0,
            }}
          >
            <img
              src={variant.icon.src}
              alt=""
              style={{
                position: 'absolute',
                left: variant.icon.x,
                top: variant.icon.y,
                width: variant.icon.w,
                height: variant.icon.h,
                display: 'block',
              }}
            />
          </div>
          <div
            style={{
              flex: '1 0 0',
              minWidth: 1,
              height: HEADER.rule.barHeight,
              background: `linear-gradient(to right, ${variant.rule.from}, ${variant.rule.to})`,
            }}
          />
        </div>

        {/* Stacked rather than inline so the anniversary variants can cross one
            year's ordinal into the next in place. The box is exactly one line
            tall (leading 1), so a single static eyebrow occupies the same space
            it did before and the header's column spacing is unchanged. */}
        <div
          data-motion="eyebrow"
          style={{ position: 'relative', width: '100%', height: HEADER.eyebrow.fontSize }}
        >
          {eyebrows.map((person, i) => (
            <p
              key={i}
              data-motion={`eyebrow-${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                margin: 0,
                width: '100%',
                fontSize: HEADER.eyebrow.fontSize,
                fontWeight: HEADER.eyebrow.weight,
                lineHeight: 1,
                letterSpacing: HEADER.eyebrow.letterSpacing,
                color: variant.eyebrowColor,
                textAlign: 'center',
                textTransform: 'uppercase',
                opacity: i === 0 ? 1 : 0,
              }}
            >
              {eyebrowTracksPerson ? resolve(variant.eyebrow, person) : data.eyebrow || resolve(variant.eyebrow, person)}
            </p>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: HEADER.group.gap,
            width: HEADER.group.width,
            flexShrink: 0,
          }}
        >
          {/*
            Stacked exactly like the eyebrow above, and for the same reason:
            the anniversary frames now take freeform per-person copy here (see
            `Person.titleText`), so the heading has to turn over with the
            carousel. `data.message` still wins when the heading is fixed
            per-card (welcome/farewell) — it never applies once the title is
            tracking the person, since each person's own text is the point.
          */}
          <div
            data-motion="title"
            style={{ position: 'relative', width: '100%', height: HEADER.title.fontSize }}
          >
            {titles.map((person, i) => (
              <p
                key={i}
                data-motion={`title-${i}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  margin: 0,
                  width: '100%',
                  fontSize: HEADER.title.fontSize,
                  fontWeight: HEADER.title.weight,
                  lineHeight: 1,
                  color: variant.titleColor,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  textTransform: variant.titleUppercase ? 'uppercase' : 'none',
                  opacity: i === 0 ? 1 : 0,
                }}
              >
                {titleTracksPerson ? resolve(variant.title, person) : data.message || resolve(variant.title, person)}
              </p>
            ))}
          </div>
          <div data-motion="title-divider">
            <Divider theme={variant.headerDivider} />
          </div>
        </div>
      </div>

      {/* ---- footer: one name block per person, crossfaded ---- */}
      {people.map((person, i) => (
        <div
          key={i}
          data-motion={`name-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: variant.footerTop,
            width: CANVAS.w,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Only the first is visible at rest; the rest are faded up as the
            // strip reaches them.
            opacity: i === 0 ? 1 : 0,
          }}
        >
          {/* The anniversary frames flank the name with laurels; the joiner
              frames have none, and then this is just the centre column. */}
          {variant.laurels ? <Laurel spec={variant.laurels} side="left" /> : null}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: FOOTER.gap,
              marginRight: variant.laurels?.overlap ?? 0,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: FOOTER.name.fontSize,
                fontWeight: FOOTER.name.weight,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                ...textFill(variant.nameFill),
              }}
            >
              {person.name}
            </p>
            <Divider theme={variant.footerDivider} />
            {/* Absent on the anniversary variants, which stop at the name —
                see the note on SILVER_ANNIVERSARY for why. */}
            {variant.subline ? (
              <p
                style={{
                  margin: 0,
                  width: variant.subline.width,
                  fontSize: FOOTER.subline.fontSize,
                  fontWeight: FOOTER.subline.weight,
                  lineHeight: 1,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  // Figma blends the gold tenure rather than stacking it flat, so
                  // it picks up the plate's warmth underneath.
                  mixBlendMode: variant.subline.lighten ? 'lighten' : undefined,
                  ...textFill(variant.subline.fill),
                }}
              >
                {resolve(variant.subline.text, person)}
              </p>
            ) : null}
          </div>

          {variant.laurels ? <Laurel spec={variant.laurels} side="right" /> : null}
        </div>
      ))}

    </div>
  );
}
