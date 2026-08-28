'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, type CSSProperties } from 'react';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import type { SceneProps } from '../birthday/BirthdayScene';
import {
  CANVAS,
  COLLAGE,
  COLUMN,
  COMMAS,
  CYAN_CIRCLE,
  DIVIDER,
  ORANGE,
  OUTLINE_CIRCLE,
  PORTRAIT,
  TEXT,
  TEXT_GAP,
} from './geometry';
import { DURATION_SECONDS, TRACKS, resolveEase, restPose, type MotionProp } from './motion';

/** Three corners rounded, the fourth square — the collage's signature shape. */
const leafRadius = (r: number) => `${r}px ${r}px 0px ${r}px`;

/**
 * An element's rest pose, as an inline transform.
 *
 * GSAP tweens away from whatever it finds here and reverts to it when the
 * timeline is seeked back to zero, so this is the single source of frame 0 —
 * see the note on `restPose`.
 */
function restStyle(target: string): CSSProperties {
  const p = restPose(target);
  const parts: string[] = [];
  if (p.x !== undefined || p.y !== undefined) parts.push(`translate(${p.x ?? 0}px, ${p.y ?? 0}px)`);
  if (p.rotation !== undefined) parts.push(`rotate(${p.rotation}deg)`);
  if (p.scaleX !== undefined || p.scaleY !== undefined) parts.push(`scale(${p.scaleX ?? 1}, ${p.scaleY ?? 1})`);
  const style: CSSProperties = {};
  if (parts.length) style.transform = parts.join(' ');
  if (p.opacity !== undefined) style.opacity = p.opacity;
  return style;
}

export default function QuoteScene({ data, frame, fps }: SceneProps) {
  /**
   * The design's tracks, expanded segment by segment.
   *
   * One `fromTo` per segment with both ends stated explicitly, and
   * `immediateRender: false` on every one of them. That combination is what
   * makes the timeline seekable in both directions: nothing writes to the DOM
   * until its own segment is the one being rendered, so frame 0 keeps the inline
   * rest pose and seeking backwards lands on the same values as seeking forwards.
   */
  const build = useCallback<TimelineBuilder>((tl) => {
    for (const track of TRACKS) {
      const selector = `[data-motion="${track.target}"]`;
      for (let i = 0; i < track.values.length - 1; i += 1) {
        const at = track.times[i] * DURATION_SECONDS;
        const duration = (track.times[i + 1] - track.times[i]) * DURATION_SECONDS;
        // Figma emits repeated keyframes to express a hold; nothing to tween.
        if (duration <= 0) continue;
        tl.fromTo(
          selector,
          { [track.prop as MotionProp]: track.values[i] },
          {
            [track.prop as MotionProp]: track.values[i + 1],
            duration,
            ease: resolveEase(track.eases[i]),
            immediateRender: false,
          },
          at,
        );
      }
    }
    // Hold the tail so the loop point is the cohort's, not the last tween's.
    tl.set({}, {}, DURATION_SECONDS);
  }, []);

  const rootRef = useSeekTimeline(build, frame, fps);

  const quote = data.message || data.subtitle || '';
  const writer = data.name || '';
  const photo = data.photoUrl || PORTRAIT.placeholder;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: CANVAS.w,
        height: CANVAS.h,
        overflow: 'hidden',
        background: '#ffffff',
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      {/* One centred column. Kept as flex so a longer or shorter quote reflows
          and the whole card stays optically centred, as it does in Figma. */}
      <div
        style={{
          position: 'absolute',
          left: COLUMN.left,
          top: '50%',
          transform: 'translateY(-50%)',
          width: COLUMN.width,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: COLUMN.gap,
        }}
      >
        {/* ---- collage ---- */}
        <div style={{ position: 'relative', width: '100%', height: COLLAGE.height, flexShrink: 0 }}>
          <div
            style={{
              position: 'absolute',
              left: COLLAGE.inner.left,
              top: 0,
              width: COLLAGE.inner.width,
              height: COLLAGE.inner.height,
            }}
          >
            <div
              data-motion="outline-circle"
              style={{
                position: 'absolute',
                left: OUTLINE_CIRCLE.left,
                top: OUTLINE_CIRCLE.top,
                width: OUTLINE_CIRCLE.size,
                height: OUTLINE_CIRCLE.size,
                borderRadius: '50%',
                border: `${OUTLINE_CIRCLE.strokeWidth}px solid ${OUTLINE_CIRCLE.stroke}`,
                boxSizing: 'border-box',
                ...restStyle('outline-circle'),
              }}
            />

            <div
              data-motion="orange-group"
              style={{
                position: 'absolute',
                left: ORANGE.group.left,
                top: ORANGE.group.top,
                width: ORANGE.group.width,
                height: ORANGE.group.height,
                ...restStyle('orange-group'),
              }}
            >
              <div
                data-motion="orange-shape"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: ORANGE.shape.fill,
                  borderRadius: leafRadius(ORANGE.shape.radius),
                  ...restStyle('orange-shape'),
                }}
              />
              <div
                data-motion="yellow-dot"
                style={{
                  position: 'absolute',
                  left: ORANGE.dot.left,
                  top: ORANGE.dot.top,
                  width: ORANGE.dot.size,
                  height: ORANGE.dot.size,
                  borderRadius: '50%',
                  background: ORANGE.dot.fill,
                  ...restStyle('yellow-dot'),
                }}
              />
            </div>

            <div
              data-motion="portrait"
              style={{
                position: 'absolute',
                left: PORTRAIT.left,
                top: PORTRAIT.top,
                width: PORTRAIT.width,
                height: PORTRAIT.height,
                borderRadius: leafRadius(PORTRAIT.radius),
                background: PORTRAIT.backdrop,
                boxShadow: PORTRAIT.shadow,
                overflow: 'hidden',
                ...restStyle('portrait'),
              }}
            >
              <img
                src={photo}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            <div
              data-motion="cyan-circle"
              style={{
                position: 'absolute',
                left: CYAN_CIRCLE.left,
                top: CYAN_CIRCLE.top,
                width: CYAN_CIRCLE.size,
                height: CYAN_CIRCLE.size,
                borderRadius: '50%',
                background: CYAN_CIRCLE.fill,
                ...restStyle('cyan-circle'),
              }}
            />
          </div>
        </div>

        {/* ---- type ---- */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: COLUMN.gap,
            width: '100%',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: TEXT_GAP,
              width: '100%',
            }}
          >
            <p
              data-motion="quote-text"
              style={{
                margin: 0,
                width: '100%',
                fontSize: TEXT.quote.fontSize,
                fontWeight: TEXT.quote.weight,
                fontStyle: 'italic',
                lineHeight: TEXT.quote.lineHeight,
                letterSpacing: 0,
                color: TEXT.color,
                textAlign: 'center',
                textTransform: 'uppercase',
                overflowWrap: 'break-word',
                ...restStyle('quote-text'),
              }}
            >
              {quote}
            </p>

            {/* Two bars fading outward from a rotated square. */}
            <div
              data-motion="divider"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: DIVIDER.gap,
                width: DIVIDER.width,
                flexShrink: 0,
                ...restStyle('divider'),
              }}
            >
              <div
                style={{
                  flex: '1 0 0',
                  height: DIVIDER.barHeight,
                  background: `linear-gradient(to left, ${DIVIDER.color}, rgba(255,255,255,0))`,
                }}
              />
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
                    borderRadius: DIVIDER.dot.radius,
                    background: DIVIDER.color,
                    transform: `rotate(${DIVIDER.dot.rotation}deg)`,
                  }}
                />
              </div>
              <div
                style={{
                  flex: '1 0 0',
                  height: DIVIDER.barHeight,
                  background: `linear-gradient(to right, ${DIVIDER.color}, rgba(255,255,255,0))`,
                }}
              />
            </div>

            <div style={{ position: 'relative', width: '100%', height: TEXT.attribution.height, flexShrink: 0 }}>
              <p
                data-motion="attribution"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  margin: 0,
                  width: '100%',
                  fontSize: TEXT.attribution.fontSize,
                  fontWeight: TEXT.attribution.weight,
                  fontStyle: 'italic',
                  lineHeight: TEXT.attribution.lineHeight,
                  color: TEXT.color,
                  textAlign: 'center',
                  textTransform: 'capitalize',
                  ...restStyle('attribution'),
                }}
              >
                {writer}
              </p>
            </div>
          </div>

          {/* The comma pair, turned over so it reads as a quote mark. */}
          <div
            data-motion="commas"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              ...restStyle('commas'),
            }}
          >
            <div style={{ transform: 'rotate(180deg)', display: 'flex', alignItems: 'center' }}>
              <img
                src={COMMAS.src}
                alt=""
                style={{
                  width: COMMAS.size,
                  height: COMMAS.size,
                  display: 'block',
                  marginRight: -COMMAS.overlap,
                  transform: 'rotate(180deg)',
                }}
              />
              <img
                src={COMMAS.src}
                alt=""
                style={{
                  width: COMMAS.size,
                  height: COMMAS.size,
                  display: 'block',
                  transform: 'rotate(180deg)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
