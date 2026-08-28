'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { Person, SceneData } from '@/lib/compositions';
import { registerFrameSeeker, seekVideoToFrame } from '@/lib/videoSync';
import { cropStyle, nodeStyle } from '@/lib/figmaTransform';
import { gradientTextStyle } from '@/lib/gradientText';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import { INTRO_VIDEO, WIPE, introFrames, videoFrames, wipeSize } from './intro';
import {
  BACKDROP,
  CANVAS,
  DIVIDER,
  EYEBROW,
  GOLD,
  GOLD_DEEP,
  GOLD_FADE,
  HALO,
  LAURELS,
  NAME,
  PORTRAIT,
  ROLE,
  STARBURST,
  TROPHY_ROW,
} from './geometry';
import {
  EASE_IN_OUT,
  EASE_OUT_EXPO,
  ENTRANCES,
  HANDOFF_SECONDS,
  MAX_PEOPLE,
  PORTRAIT_MOTION,
  SPRING_SCALE,
  STARBURST_MOTION,
  segmentSeconds,
  totalSeconds,
} from './motion';

export interface SceneProps {
  data: SceneData;
  frame: number;
  fps: number;
}

const SANS = 'var(--font-inter), sans-serif';

/** A rule that fades from gold to nothing. `flip` mirrors it, as Figma does. */
function FadingRule({ x, y, w, h, flip }: { x: number; y: number; w: number; h: number; flip?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundImage: `linear-gradient(to ${flip ? 'left' : 'right'}, ${GOLD}, ${GOLD_FADE})`,
      }}
    />
  );
}

/**
 * Splits the awardee's name across the two 174px lines the design lays out.
 *
 * Figma models these as two separate text nodes ("Aryan" / "Baghel"), so a
 * single-field name has to be divided somewhere: everything before the last
 * space goes on line one, the rest on line two. A one-word name simply leaves
 * the second line empty rather than forcing a break mid-word.
 */
function splitName(name: string): [string, string] {
  const trimmed = name.trim();
  const cut = trimmed.lastIndexOf(' ');
  return cut === -1 ? [trimmed, ''] : [trimmed.slice(0, cut), trimmed.slice(cut + 1)];
}

/**
 * Everyone being recognised.
 *
 * `people` is the multi-awardee path; a caller that only knows about one person
 * still gets a valid single-awardee card out of the flat name/photo/subtitle
 * fields, which is the shape every other scene uses.
 */
function resolvePeople(data: SceneData): Person[] {
  const list = data.people?.length
    ? data.people
    : [{ name: data.name, photoUrl: data.photoUrl, subtitle: data.subtitle }];
  return list.slice(0, MAX_PEOPLE);
}

/** One awardee's full card. Every animated part carries its own `data-motion`. */
function AwardCard({ person, eyebrow }: { person: Person; eyebrow: string }) {
  const [firstName, lastName] = splitName(person.name);

  return (
    <>
      <div data-motion="trophy-row">
        <FadingRule x={TROPHY_ROW.leftRuleX} y={TROPHY_ROW.ruleY} w={TROPHY_ROW.ruleW} h={TROPHY_ROW.ruleH} flip />
        <img
          src={TROPHY_ROW.icon.src}
          alt=""
          style={{
            position: 'absolute',
            left: TROPHY_ROW.icon.x,
            top: TROPHY_ROW.icon.y,
            width: TROPHY_ROW.icon.size,
            height: TROPHY_ROW.icon.size,
          }}
        />
        <FadingRule x={TROPHY_ROW.rightRuleX} y={TROPHY_ROW.ruleY} w={TROPHY_ROW.ruleW} h={TROPHY_ROW.ruleH} />
      </div>

      <p
        data-motion="eyebrow"
        style={{
          position: 'absolute',
          left: 0,
          top: EYEBROW.y,
          width: CANVAS.w,
          margin: 0,
          textAlign: 'center',
          textTransform: 'uppercase',
          fontSize: EYEBROW.fontSize,
          lineHeight: `${EYEBROW.fontSize}px`,
          letterSpacing: EYEBROW.letterSpacing,
          fontWeight: 600,
          color: EYEBROW.color,
        }}
      >
        {eyebrow}
      </p>

      <div
        data-motion="name"
        style={{
          position: 'absolute',
          left: 0,
          top: NAME.y,
          width: CANVAS.w,
          display: 'flex',
          flexDirection: 'column',
          gap: NAME.gap,
          alignItems: 'center',
        }}
      >
        {[firstName, lastName].map((line, i) =>
          line ? (
            <p
              key={i}
              style={{
                margin: 0,
                fontSize: NAME.fontSize,
                lineHeight: `${NAME.lineHeight}px`,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                ...gradientTextStyle(NAME.gradient, NAME.lineHeight),
              }}
            >
              {line}
            </p>
          ) : null,
        )}
      </div>

      <div data-motion="divider" style={{ transformOrigin: 'center center' }}>
        <FadingRule x={DIVIDER.leftRuleX} y={DIVIDER.ruleY} w={DIVIDER.ruleW} h={DIVIDER.ruleH} flip />
        <div
          style={{
            ...nodeStyle(DIVIDER.diamond.transform, DIVIDER.diamond.size, DIVIDER.diamond.size),
            backgroundImage: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`,
          }}
        />
        <FadingRule x={DIVIDER.rightRuleX} y={DIVIDER.ruleY} w={DIVIDER.ruleW} h={DIVIDER.ruleH} />
      </div>

      <div data-motion="role">
        <p
          style={{
            position: 'absolute',
            left: 0,
            top: ROLE.y,
            width: CANVAS.w,
            margin: 0,
            textAlign: 'center',
            fontSize: ROLE.fontSize,
            lineHeight: `${ROLE.fontSize}px`,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            ...gradientTextStyle(ROLE.gradient, ROLE.fontSize),
          }}
        >
          {person.subtitle}
        </p>
        <img
          src={ROLE.rule.src}
          alt=""
          style={{
            position: 'absolute',
            left: ROLE.rule.x,
            top: ROLE.rule.y,
            width: ROLE.rule.w,
            height: ROLE.rule.h,
          }}
        />
      </div>

      <div data-motion="laurel-left">
        <img src={LAURELS.left.src} alt="" style={nodeStyle(LAURELS.left.transform, LAURELS.w, LAURELS.h)} />
      </div>
      <div data-motion="laurel-right">
        <img src={LAURELS.right.src} alt="" style={nodeStyle(LAURELS.right.transform, LAURELS.w, LAURELS.h)} />
      </div>

      {/* Outer box clips; the inner one is what slides, so the crop window
          stays put while the portrait rises through it. */}
      <div
        style={{
          position: 'absolute',
          left: PORTRAIT.x,
          top: PORTRAIT.y,
          width: PORTRAIT.w,
          height: PORTRAIT.h,
          overflow: 'hidden',
        }}
      >
        <div data-motion="portrait" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {/*
            No special case for uploads here, and that is the point.

            An uploaded photo is processed on the way in — background removed,
            desaturated, framed to the chest, and composited into the same
            941x1672 layout the design's own asset uses (see
            `api/uploads/portrait.ts`). So by the time it reaches this element it
            IS the design's shape, and Figma's own crop transform frames it
            correctly. Treating it here instead would mean a CSS filter in the
            render path and two different framings to keep in step.
          */}
          <img src={person.photoUrl || PORTRAIT.src} alt="" style={cropStyle(PORTRAIT.crop)} />
        </div>
      </div>
    </>
  );
}

/**
 * The opening clip.
 *
 * Seeked, never played — the same contract every video in this project honours
 * (see `@/lib/videoSync`): the layout effect keeps it matched to the frame on
 * screen so it moves in the live preview, and the registered seeker lets the
 * headless renderer await the decode before it screenshots. Playing it would
 * make every capture land on a different position.
 *
 * Mounted only while the clip is actually on screen. Once the wipe starts this
 * unmounts, which also unregisters the seeker — so the rest of the composition
 * does not pay for a decode nothing can see. The renderer's readiness gate runs
 * at frame 0, while it is still mounted, so nothing is missed by letting it go.
 */
function IntroClip({ frame, fps }: { frame: number; fps: number }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(
    () =>
      registerFrameSeeker(async (target) => {
        if (ref.current) await seekVideoToFrame(ref.current, target, fps);
      }),
    [fps],
  );

  useLayoutEffect(() => {
    if (ref.current) void seekVideoToFrame(ref.current, frame, fps);
  }, [frame, fps]);

  return (
    <video
      ref={ref}
      src={INTRO_VIDEO.src}
      muted
      playsInline
      preload="auto"
      style={{
        position: 'absolute',
        inset: 0,
        width: CANVAS.w,
        height: CANVAS.h,
        objectFit: 'cover',
      }}
    />
  );
}

/**
 * The diamond wipe that hands the screen to the card.
 *
 * A white square turned -45 degrees over a black plate, growing about a fixed
 * point — see `./intro` for why Figma's two boxes reduce to exactly that. The
 * square is centred on the point with a negative half-side offset rather than a
 * flex wrapper, so the turn happens about the same point at every size.
 */
function IntroWipe({ size }: { size: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: WIPE.plate, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: WIPE.centre.x - size / 2,
          top: WIPE.centre.y - size / 2,
          width: size,
          height: size,
          background: WIPE.fill,
          transform: `rotate(${WIPE.rotation}deg)`,
        }}
      />
    </div>
  );
}

export default function MvpScene({ data, frame, fps }: SceneProps) {
  const people = resolvePeople(data);
  const count = people.length;
  const eyebrow = data.message?.trim() || 'Most Valuable Player';

  /**
   * The opening is opt-in, so the card has to be able to start at two different
   * places on the clock. Its own timeline is seeked to `cardFrame`, which holds
   * at 0 for the whole opening and then runs exactly as it always has — so with
   * the intro off, `cardFrame` is `frame` and nothing about this scene changes.
   */
  const withIntro = data.intro === true;
  const introLength = withIntro ? introFrames(fps) : 0;
  const cardFrame = Math.max(0, frame - introLength);
  const clipRuns = withIntro && frame < videoFrames(fps);
  const wipe = withIntro ? wipeSize(frame, fps) : null;

  const build = useCallback<TimelineBuilder>(
    (tl) => {
      const segment = segmentSeconds(count);
      const total = totalSeconds(count);

      // The starburst belongs to the backdrop, not to any one awardee: it spins
      // in once and then makes a single slow revolution across the whole clip,
      // which is what keeps the loop point seamless however many people share
      // the award.
      tl.fromTo(
        '[data-motion="starburst"]',
        { rotation: STARBURST_MOTION.rotate.from },
        {
          rotation: STARBURST_MOTION.rotate.rest,
          duration: STARBURST_MOTION.rotate.spinEndsAt,
          ease: EASE_IN_OUT,
        },
        0,
      ).to(
        '[data-motion="starburst"]',
        {
          rotation: STARBURST_MOTION.rotate.end,
          duration: total - STARBURST_MOTION.rotate.spinEndsAt,
          ease: 'none',
        },
        STARBURST_MOTION.rotate.spinEndsAt,
      );

      tl.from(
        '[data-motion="starburst"]',
        {
          scale: STARBURST_MOTION.scale.from,
          duration: STARBURST_MOTION.scale.endsAt - STARBURST_MOTION.scale.startsAt,
          ease: SPRING_SCALE,
        },
        STARBURST_MOTION.scale.startsAt,
      );

      for (let i = 0; i < count; i += 1) {
        const card = `[data-person="${i}"]`;
        const base = i * segment;

        // Only one card is on screen at a time. The first is already visible;
        // the rest are revealed exactly as the previous one finishes fading,
        // so their own entrance tracks play against an empty stage.
        if (i > 0) tl.set(card, { opacity: 1 }, base);
        if (i < count - 1) {
          tl.to(card, { opacity: 0, duration: HANDOFF_SECONDS, ease: 'power1.in' }, base + segment - HANDOFF_SECONDS);
        }

        tl.from(
          `${card} [data-motion="portrait"]`,
          {
            y: PORTRAIT_MOTION.fromY,
            duration: PORTRAIT_MOTION.endsAt - PORTRAIT_MOTION.startsAt,
            ease: 'power2.out',
          },
          base + PORTRAIT_MOTION.startsAt,
        );

        // Each entrance fades and moves on its own clock — Figma gives the two
        // slightly different end times, so they are two tweens, not one.
        for (const track of ENTRANCES) {
          const selector = `${card} [data-motion="${track.target}"]`;
          tl.from(selector, { opacity: 0, duration: track.fadeDuration, ease: EASE_OUT_EXPO }, base + track.delay);
          tl.from(selector, { ...track.from, duration: track.moveDuration, ease: EASE_OUT_EXPO }, base + track.delay);
        }
      }

      // Hold the tail so the loop point is the design's, not the last tween's.
      tl.set({}, {}, total);
    },
    [count],
  );

  const rootRef = useSeekTimeline(build, cardFrame, fps);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: CANVAS.w,
        height: CANVAS.h,
        overflow: 'hidden',
        background: '#ffffff',
        fontFamily: SANS,
      }}
    >
      <img
        src={BACKDROP}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <div
        style={{
          position: 'absolute',
          left: HALO.x,
          top: HALO.y,
          width: HALO.size,
          height: HALO.size,
          borderRadius: '50%',
          background: HALO.color,
        }}
      />

      {/* Centred on its own middle so the timeline can spin it in place. */}
      <div
        data-motion="starburst"
        style={{
          position: 'absolute',
          left: STARBURST.centerX - STARBURST.w / 2,
          top: STARBURST.centerY - STARBURST.h / 2,
          width: STARBURST.w,
          height: STARBURST.h,
          transformOrigin: 'center center',
        }}
      >
        <img src={STARBURST.src} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {people.map((person, i) => (
        <div
          key={i}
          data-person={i}
          style={{ position: 'absolute', inset: 0, opacity: i === 0 ? 1 : 0 }}
        >
          <AwardCard person={person} eyebrow={eyebrow} />
        </div>
      ))}

      {/* Last, so it covers the card while it is on screen. The wipe ends on a
          white frame and the card's own plate is white, which is what makes the
          handoff read as one continuous move rather than a cut. */}
      {clipRuns ? <IntroClip frame={frame} fps={fps} /> : null}
      {wipe !== null ? <IntroWipe size={wipe} /> : null}
    </div>
  );
}
