'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { SceneData } from '@/lib/compositions';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import {
  BACKGROUND,
  CANVAS,
  COVER,
  PHOTO_CARDS,
  STICKERS,
  TEXT,
  cropStyle,
  nodeStyle,
  type PhotoCard,
  type Sticker as StickerSpec,
} from './geometry';
import {
  CLOUD_CYCLE_SECONDS,
  CLOUD_TRAVEL_PX,
  DURATION_SECONDS,
  EASE,
  TRACKS,
} from './motion';

export interface SceneProps {
  data: SceneData;
  frame: number;
  fps: number;
}

/** Figma reports the title and closing line as `Inria Serif: Bold`. */
const SERIF = "var(--font-inria), 'Inria Serif', serif";
const SANS = 'var(--font-inter), sans-serif';

/**
 * One polaroid.
 *
 * Two nested elements on purpose: the outer carries the node's Figma matrix and
 * never moves, the inner is what the timeline animates. Keeping them apart means
 * GSAP writes a clean `transform` on the inner element instead of having to
 * recompose the rotation on every frame — and the card's rise reads as a slide
 * along its own tilt, which is what the design does.
 */
function Polaroid({ card }: { card: PhotoCard }) {
  return (
    <div style={nodeStyle(card.transform, card.w, card.h)}>
      <div
        data-motion={`card-${card.id}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: card.photo.x,
            top: card.photo.y,
            width: card.photo.w,
            height: card.photo.h,
            background: card.backdrop,
            overflow: 'hidden',
          }}
        >
          <img src={card.src} alt="" style={card.crop ? cropStyle(card.crop) : COVER} />
        </div>
      </div>
    </div>
  );
}

/** A desk oddment — clip, pin, tape, cookie. Same two-element split as the cards. */
function Sticker({ spec, motion }: { spec: StickerSpec; motion: string }) {
  return (
    <div style={nodeStyle(spec.transform, spec.w, spec.h)}>
      <div
        data-motion={motion}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      >
        <img src={spec.src} alt="" style={spec.crop ? cropStyle(spec.crop) : COVER} />
      </div>
    </div>
  );
}

function textStyle(
  t: { x: number; y: number; fontSize: number; lineHeight: number; letterSpacing: number; color: string },
  extra: CSSProperties,
): CSSProperties {
  return {
    position: 'absolute',
    left: t.x,
    top: t.y,
    margin: 0,
    fontSize: t.fontSize,
    lineHeight: `${t.lineHeight}px`,
    letterSpacing: t.letterSpacing,
    color: t.color,
    fontWeight: 400,
    ...extra,
  };
}

export default function AchievementsScene({ data, frame, fps }: SceneProps) {
  /**
   * The design's own timeline, replayed by seeking.
   *
   * `.from()` is what makes the holds work: GSAP renders a from-tween's start state
   * immediately, so a layer sits at `opacity: 0` from frame 0 until its delay comes
   * round, then eases in and stays. That reproduces Figma's four-keyframe
   * hold/ease/hold tracks without spelling each keyframe out.
   */
  const build = useCallback<TimelineBuilder>((tl) => {
    for (const track of TRACKS) {
      tl.from(
        `[data-motion="${track.target}"]`,
        { ...track.from, duration: track.duration, ease: EASE },
        track.delay,
      );
    }
    // The last track settles at 1.5s but Figma's cohort runs to 2s before looping.
    // Padding the timeline keeps the tail of held frames, so the loop point is the
    // design's, not the last tween's.
    tl.set({}, {}, DURATION_SECONDS);

    // The clouds drift on their own, much longer clock — linear, as the design
    // states. This is also what sets the scene's loop length: the entrance is
    // over inside the first 1.5s, the drift runs the remaining 22.5s.
    tl.fromTo(
      '[data-motion="clouds"]',
      { x: 0 },
      { x: -CLOUD_TRAVEL_PX, duration: CLOUD_CYCLE_SECONDS, ease: 'none' },
      0,
    );
  }, []);

  const rootRef = useSeekTimeline(build, frame, fps);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: CANVAS.w,
        height: CANVAS.h,
        overflow: 'hidden',
        fontFamily: SANS,
      }}
    >
      {/* The sky plate. The cloud plate over it is opaque, so this is only ever
          visible in the instant before that decodes. */}
      <img src={BACKGROUND.sky} alt="" style={COVER} />

      {/* The drifting cloud plate. One copy: the design pans it 2829.5px, well
          inside the plate's own headroom, so nothing has to be tiled. Clipped to
          the canvas by the wrapper. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <img
          data-motion="clouds"
          src={BACKGROUND.clouds.src}
          alt=""
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: BACKGROUND.clouds.w,
            height: '100%',
            display: 'block',
            // Tailwind's preflight sets `img { max-width: 100% }`, which silently
            // clamps this 9557px-wide plate to its 1080px parent while
            // `height: 100%` holds the height — squashing the sky by 8.9x into
            // vertical streaks. Figma's own export marks every image `max-w-none`
            // for exactly this reason.
            maxWidth: 'none',
          }}
        />
      </div>

      {/* The haze the design lays over the blurred sky. A flat fill rather than a
          `backdrop-filter`, since the blur it would have applied is already baked
          into the plate — see BACKGROUND in ./geometry. */}
      <div style={{ position: 'absolute', inset: 0, background: BACKGROUND.haze }} />

      {/* Everything below is in Figma z-order, back to front. Each card's crop
          was tuned to its own design asset's exact framing, so an override drops
          that crop for plain object-fit — any photo drops in cleanly, but only
          the design asset gets the hand-tuned crop. */}
      {PHOTO_CARDS.map((card, i) => {
        const override = data.photos?.[i];
        const effective = override ? { ...card, src: override, crop: undefined } : card;
        return <Polaroid key={card.id} card={effective} />;
      })}

      <Sticker spec={STICKERS.binderClip} motion="binder-clip" />

      <p data-motion="title" style={textStyle(TEXT.title, { whiteSpace: 'nowrap', fontFamily: SERIF, fontWeight: 700 })}>
        {data.name}
      </p>

      <Sticker spec={STICKERS.paperClip} motion="paper-clip" />
      <Sticker spec={STICKERS.washiTape} motion="washi-tape" />
      <Sticker spec={STICKERS.heartCookie} motion="heart-cookie" />

      <p data-motion="closer" style={textStyle(TEXT.closer, { width: TEXT.closer.w, fontFamily: SERIF, fontWeight: 700 })}>
        {data.message}
      </p>

      {/* Mirrored in Figma; the flip lives in the node matrix, so the timeline
          only has to scale it up. */}
      <Sticker spec={STICKERS.pushPin} motion="push-pin" />

      <p data-motion="names" style={textStyle(TEXT.names, { width: TEXT.names.w, fontFamily: SANS })}>
        {data.subtitle}
      </p>
    </div>
  );
}
