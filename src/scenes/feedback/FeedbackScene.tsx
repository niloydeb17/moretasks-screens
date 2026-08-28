'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, useMemo } from 'react';
import type { SceneData, Testimonial } from '@/lib/compositions';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import type { SceneProps } from '../birthday/BirthdayScene';
import {
  BACKGROUND,
  BODY,
  CANVAS,
  CARD,
  FOOTER,
  PLATE,
  QUOTE,
  STRIP,
} from './geometry';
import {
  EASE_OUT_EXPO,
  ENTRANCE,
  MAX_TESTIMONIALS,
  PAN_EASE,
  PAN_SECONDS,
  STRIP_STEP_SIGN,
  panStartsAt,
  totalSeconds,
} from './motion';

const SANS = 'var(--font-inter), sans-serif';

/**
 * The testimonials this render pans through.
 *
 * `testimonials` is the real path; a caller that only knows the flat fields
 * still gets one valid card out of `message`/`name`/`subtitle`, which is the
 * single-person shape every other scene accepts.
 */
function resolveTestimonials(data: SceneData): Testimonial[] {
  const list = data.testimonials?.length
    ? data.testimonials
    : [
        {
          quote: data.message ?? '',
          name: data.name,
          role: data.subtitle,
          photoUrl: data.photoUrl,
        },
      ];
  return list.slice(0, MAX_TESTIMONIALS);
}

/**
 * One pair of quote marks.
 *
 * Two copies of the same glyph overlapping, with a transform on each glyph and
 * another on the pair — reproduced as Figma nests it rather than collapsed into
 * one transform. See the note on QUOTE in ./geometry for why collapsing it is a
 * trap: `rotate(180)` followed by `scaleY(-1)` composes to a HORIZONTAL mirror,
 * so the tempting simplification turns the glyph the wrong way.
 */
function QuotePair({ side }: { side: 'open' | 'close' }) {
  const at = side === 'open' ? QUOTE.open : QUOTE.close;
  return (
    <div
      data-motion={side === 'open' ? 'open-quote' : 'close-quote'}
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        width: QUOTE.pairW,
        height: QUOTE.box,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          transform: side === 'open' ? 'scaleY(-1)' : 'rotate(180deg)',
        }}
      >
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              width: QUOTE.box,
              height: QUOTE.box,
              flexShrink: 0,
              marginRight: i === 0 ? QUOTE.overlap : 0,
              transform: 'rotate(180deg)',
            }}
          >
            <svg
              width={QUOTE.box}
              height={QUOTE.box}
              viewBox={`0 0 ${QUOTE.box} ${QUOTE.box}`}
              style={{ display: 'block' }}
              aria-hidden
            >
              <path d={QUOTE.path} fill={QUOTE.fill} fillOpacity={QUOTE.opacity} />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The person: a photo on a turned orange card, then name over role. */
function Person({ entry }: { entry: Testimonial }) {
  const { photo, text } = FOOTER;
  return (
    <div
      data-motion="person"
      style={{
        position: 'absolute',
        left: FOOTER.x,
        top: FOOTER.y,
        display: 'flex',
        alignItems: 'center',
        gap: FOOTER.gap,
      }}
    >
      <div style={{ position: 'relative', width: photo.box, height: photo.box, flexShrink: 0 }}>
        {/* The orange card is centred in the box and turned; the photo sits
            down-right of it, which is what leaves the orange showing at the
            top-left corner only. */}
        <div
          style={{
            position: 'absolute',
            left: (photo.box - photo.card.size) / 2,
            top: (photo.box - photo.card.size) / 2,
            width: photo.card.size,
            height: photo.card.size,
            background: photo.card.fill,
            transform: `rotate(${photo.card.rotation}deg)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: photo.image.x,
            top: photo.image.y,
            width: photo.image.size,
            height: photo.image.size,
            background: photo.image.placeholder,
            overflow: 'hidden',
          }}
        >
          {entry.photoUrl ? (
            <img
              src={entry.photoUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : null}
        </div>
      </div>

      <div
        style={{
          width: 'max-content',
          maxWidth: text.maxW,
          color: text.color,
          textTransform: 'capitalize',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <p
          style={{
            margin: 0,
            // Figma's negative bottom margin, which is what tucks the role up
            // under the name rather than leaving a line's worth of gap.
            marginBottom: text.name.pullUp,
            width: '100%',
            fontSize: text.name.fontSize,
            fontWeight: text.name.weight,
            lineHeight: text.lineHeight,
          }}
        >
          {entry.name}
        </p>
        <p
          style={{
            margin: 0,
            width: '100%',
            fontSize: text.role.fontSize,
            fontWeight: text.role.weight,
            lineHeight: text.lineHeight,
          }}
        >
          {entry.role}
        </p>
      </div>
    </div>
  );
}

/** One testimonial card: the white plate and everything on it. */
function Card({ entry }: { entry: Testimonial }) {
  // Blank lines are dropped rather than rendered: Figma's third card ends on a
  // paragraph holding nothing but a zero-width space, which would otherwise
  // push the text block up by a line for no visible reason.
  const paragraphs = entry.quote
    .split('\n')
    .map((line) => line.replace(/​/g, '').trim())
    .filter(Boolean);

  return (
    <div style={{ position: 'relative', width: CARD.w, height: CARD.h, flexShrink: 0 }}>
      <div
        data-motion="card"
        style={{
          position: 'absolute',
          inset: 0,
          background: PLATE.fill,
          clipPath: PLATE.clip,
        }}
      />

      <QuotePair side="open" />

      <div
        data-motion="body"
        style={{
          position: 'absolute',
          left: BODY.x,
          top: BODY.y,
          width: BODY.w,
          fontSize: BODY.fontSize,
          lineHeight: BODY.lineHeight,
          color: BODY.color,
          // Figma sets this justified, but stretching short uppercase lines to a
          // fixed width opens up "rivers" — ragged vertical gaps where the extra
          // space lands in roughly the same spot line after line. Left-aligned
          // reads as normal paragraph text instead.
          textAlign: 'left',
          textTransform: 'uppercase',
          wordBreak: 'break-word',
        }}
      >
        {paragraphs.map((line, i) => (
          <p key={i} style={{ margin: 0 }}>
            {line}
          </p>
        ))}
      </div>

      <Person entry={entry} />
      <QuotePair side="close" />
    </div>
  );
}

/**
 * "Feedback" — Figma node 604:57329 in file BPG2IS230Tr5g6YITfEdXg.
 *
 * A strip of testimonial cards panning one at a time. Each card holds for as
 * long as its own quote takes to read, which is why the timing lives in
 * ./motion as a function of the text rather than as a constant — see the note
 * there, and note that Figma states no timing for this frame at all.
 */
export default function FeedbackScene({ data, frame, fps }: SceneProps) {
  const entries = useMemo(() => resolveTestimonials(data), [data]);
  const count = entries.length;

  /**
   * The pan times and the loop length, precomputed.
   *
   * Each card holds for as long as its own quote takes to read, so the schedule
   * genuinely depends on the text — and it is derived once here rather than
   * inside the timeline builder so the builder depends on this settled object
   * instead of on an array rebuilt every render.
   */
  const schedule = useMemo(() => {
    const quotes = entries.map((e) => e.quote);
    return {
      pans: quotes.map((_, i) => panStartsAt(quotes, i)),
      total: totalSeconds(quotes),
    };
  }, [entries]);

  const build = useCallback<TimelineBuilder>(
    (tl) => {
      // The card and its contents rise in, staggered top to bottom so the eye
      // follows the reading order. Every card's copy is animated, not just the
      // first — only the first is on screen, so the rest cost nothing visible
      // and it keeps the selectors simple.
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

      // One pan per gap between testimonials, so a single one never moves.
      for (let step = 0; step < count - 1; step += 1) {
        tl.to(
          '[data-motion="strip"]',
          {
            x: STRIP_STEP_SIGN * (step + 1) * STRIP.step,
            duration: PAN_SECONDS,
            ease: PAN_EASE,
          },
          schedule.pans[step],
        );
      }

      // Hold the tail so the loop point is the last card's full read, not the
      // moment its pan finished.
      tl.set({}, {}, schedule.total);
    },
    [count, schedule],
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
        background: BACKGROUND,
        fontFamily: SANS,
      }}
    >
      <div
        data-motion="strip"
        style={{
          position: 'absolute',
          left: STRIP.x,
          top: STRIP.y,
          display: 'flex',
          alignItems: 'center',
          gap: STRIP.gap,
        }}
      >
        {entries.map((entry, i) => (
          <Card key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}
