'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { Person, SceneData } from '@/lib/compositions';
import { springEase } from '@/lib/spring';
import { registerFrameSeeker, seekVideoToFrame } from '@/lib/videoSync';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import {
  BACKDROP_VIDEO,
  CANVAS,
  CAPTION_HEIGHT,
  CARD,
  CARD_BORDER,
  CARD_SHADOW,
  CAROUSEL,
  COLORS,
  GENTLE_SPRING,
  HAT_LOCAL,
  MAX_CARDS,
  PHOTO,
  RING,
  RING_LEFT,
  RING_REST_ROTATIONS,
  RING_SLOTS,
  RING_TOP,
  activeSlotIndex,
} from './geometry';

export interface SceneProps {
  data: SceneData;
  frame: number;
  fps: number;
}

/** Figma's "Gentle" Smart Animate preset, as real spring physics. */
const GENTLE_EASE = springEase(
  GENTLE_SPRING.mass,
  GENTLE_SPRING.stiffness,
  GENTLE_SPRING.damping,
  CAROUSEL.durationSeconds,
);

/**
 * Everyone this render should cycle through.
 *
 * `people` is the multi-person path; a caller that only knows about one person
 * still gets a valid single-card carousel out of the flat name/photo/subtitle
 * fields, which is what every scene besides this one uses.
 */
function resolvePeople(data: SceneData): Person[] {
  const list = data.people?.length
    ? data.people
    : [{ name: data.name, photoUrl: data.photoUrl, subtitle: data.subtitle }];
  return list.slice(0, MAX_CARDS);
}

/**
 * The looping background footage, positioned exactly as Figma places its
 * video-filled rectangle.
 *
 * Driven purely by seeking, never played: the layout effect keeps it matched to
 * the frame on screen (which is what makes it move in the live preview), and
 * the registered seeker lets the headless renderer await the decode before it
 * screenshots. Playing it instead would make every capture a different clip.
 */
function BackdropVideo({ frame, fps }: { frame: number; fps: number }) {
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
      src={BACKDROP_VIDEO.src}
      muted
      playsInline
      preload="auto"
      style={{
        position: 'absolute',
        left: BACKDROP_VIDEO.x,
        top: BACKDROP_VIDEO.y,
        width: BACKDROP_VIDEO.w,
        height: BACKDROP_VIDEO.h,
        objectFit: 'cover',
      }}
    />
  );
}

/** The polaroid and its party hat — one rigid unit, as Figma nests them. */
function CardUnit({ person }: { person: Person }) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: COLORS.cardWhite,
          boxShadow: CARD_SHADOW,
          // The photo box is taller than the card, so clip it at the card edge.
          overflow: 'hidden',
        }}
      >
        {/* Sized to the full card inset by the border; the caption band below
            overlays its bottom edge, exactly as the Figma layer stack does. */}
        <div
          style={{
            position: 'absolute',
            left: CARD_BORDER,
            top: CARD_BORDER,
            width: PHOTO.w,
            height: PHOTO.h,
            overflow: 'hidden',
          }}
        >
          <img
            src={person.photoUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        {/* Caption band: 24px padding, 91px name line, 10px gap, 68px date row, 24px padding = 217px */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: CARD.w,
            height: CAPTION_HEIGHT,
            background: COLORS.cardWhite,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '24px 10px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              width: '100%',
              fontSize: 75,
              fontWeight: 600,
              lineHeight: 'normal',
              textTransform: 'capitalize',
              color: COLORS.nameText,
              whiteSpace: 'nowrap',
            }}
          >
            {person.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 10,
              width: '100%',
              fontSize: 40,
              fontWeight: 600,
              lineHeight: 'normal',
              textTransform: 'capitalize',
              color: COLORS.subtitleText,
              whiteSpace: 'nowrap',
            }}
          >
            {person.subtitle}
          </div>
        </div>
      </div>

      <img
        src="/assets/birthday/party-hat.svg"
        alt=""
        style={{
          position: 'absolute',
          left: HAT_LOCAL.x,
          top: HAT_LOCAL.y,
          width: HAT_LOCAL.w,
          height: HAT_LOCAL.h,
        }}
      />
    </>
  );
}

export default function BirthdayScene({ data, frame, fps }: SceneProps) {
  const people = resolvePeople(data);
  const count = people.length;

  /**
   * Only mount slots the carousel actually visits. Consecutive steps claim
   * consecutive visible positions on the ring, so both the outgoing and
   * incoming cards remain present throughout every turn. Rendering all 16
   * physical slots duplicated large photos and hats in every rasterized frame
   * even when the payload only contained one or two people.
   */
  const occupiedSlots = people.map((person, step) => ({
    person,
    slotIndex: activeSlotIndex(step),
  }));

  const build = useCallback<TimelineBuilder>(
    (tl) => {
      // The carousel: hold on a card, turn to the next, repeat. One turn per
      // gap between people — a single person never moves, matching Figma
      // (a one-card set carries no reaction at all).
      for (let step = 0; step < count - 1; step += 1) {
        tl.to(
          '[data-motion="ring"]',
          {
            rotation: RING_REST_ROTATIONS[step + 1],
            duration: CAROUSEL.durationSeconds,
            ease: GENTLE_EASE,
          },
          CAROUSEL.holdSeconds * (step + 1) + CAROUSEL.durationSeconds * step,
        );
      }

      // The background is a video, driven by seeking rather than by this
      // timeline (see BackdropVideo) — it loops on its own clock, independent
      // of the card interaction, exactly as the video fill does in Figma.
    },
    [count],
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
        background: COLORS.bg,
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <BackdropVideo frame={frame} fps={fps} />

      <div
        data-motion="ring"
        style={{
          position: 'absolute',
          left: RING_LEFT,
          top: RING_TOP,
          width: RING.size,
          height: RING.size,
          transform: `rotate(${RING_REST_ROTATIONS[0]}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {occupiedSlots.map(({ person, slotIndex }) => {
          const slot = RING_SLOTS[slotIndex];
          return (
            <div
              key={slotIndex}
              style={{
                position: 'absolute',
                left: slot.x,
                top: slot.y,
                width: CARD.w,
                height: CARD.h,
                transform: `rotate(${slot.rot}deg)`,
                transformOrigin: 'top left',
              }}
            >
              <CardUnit person={person} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
