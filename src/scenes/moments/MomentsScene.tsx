'use client';

/* eslint-disable @next/next/no-img-element -- The render surface must be pixel-exact:
   next/image injects srcset, lazy loading, and a wrapper, any of which can shift a
   frame between the preview and the headless capture. Plain <img> is deliberate. */

import { useCallback, useMemo } from 'react';
import type { Achievement, Quote, SceneData } from '@/lib/compositions';
import { useSeekTimeline, type TimelineBuilder } from '@/lib/useSeekTimeline';
import type { SceneProps } from '../birthday/BirthdayScene';
import AchievementsScene from '../achievements/AchievementsScene';
import { CANVAS as ACHIEVEMENTS_CANVAS } from '../achievements/geometry';
import QuoteScene from '../quote/QuoteScene';
import { CANVAS as QUOTE_CANVAS } from '../quote/geometry';
import {
  CANVAS,
  CARD,
  MAX_SCREENS,
  PLACEHOLDER,
  TILE,
  WALL_BG,
  buildWall,
  tileCentre,
  type Wall,
} from './geometry';
import {
  EASE,
  HOLD_SECONDS,
  INTRO_HOLD_SECONDS,
  OVERVIEW_SCALE,
  PAN_SECONDS,
  PULL_BACK_SECONDS,
  ZOOM_IN_SECONDS,
  ZOOM_OUT_SECONDS,
  ZOOM_SCALE,
  zoomInAt,
} from './motion';

/**
 * The shorts this render should fly over.
 *
 * `photos` is the per-short thumbnail list — the same field achievements uses
 * for its polaroid overrides. An entry may be an empty string, which is a real
 * state rather than a mistake: it means "this short exists, its thumbnail
 * hasn't been supplied yet", and renders as a numbered placeholder tile. That
 * is what lets someone lay out a five-short wall before collecting any artwork.
 */
function resolveShorts(data: SceneData): string[] {
  const achievements = data.achievements?.length ?? 0;
  // With achievements in the payload the wall no longer needs a filler short to
  // exist, so an empty list stays empty rather than being padded to one.
  const list = data.photos?.length ? data.photos : achievements > 0 ? [] : [''];
  return list.slice(0, Math.max(0, MAX_SCREENS - achievements));
}

function resolveAchievements(data: SceneData): Achievement[] {
  return (data.achievements ?? []).slice(0, MAX_SCREENS);
}

function resolveQuotes(data: SceneData): Quote[] {
  const achievements = data.achievements?.length ?? 0;
  return (data.quotes ?? []).slice(0, Math.max(0, MAX_SCREENS - achievements));
}

/** Same 9:16 reasoning as the achievements collage — one uniform scale, no crop. */
const QUOTE_SCALE = TILE.w / QUOTE_CANVAS.w;

/** One embedded quote card, scaled into its tile. */
function QuoteTile({ quote, frame, fps }: { quote: Quote; frame: number; fps: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: QUOTE_CANVAS.w,
        height: QUOTE_CANVAS.h,
        transform: `scale(${QUOTE_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      <QuoteScene
        // The card reads writer/quote/picture off the flat scene shape.
        data={{
          name: quote.writer,
          message: quote.text,
          photoUrl: quote.photoUrl,
          subtitle: '',
        }}
        frame={frame}
        fps={fps}
      />
    </div>
  );
}

/**
 * A tile is exactly 9:16, the same ratio the achievements collage is composed
 * at, so the whole 1080 x 1920 scene drops into one tile under a single uniform
 * scale — no letterboxing and no crop.
 */
const ACHIEVEMENTS_SCALE = TILE.w / ACHIEVEMENTS_CANVAS.w;

/**
 * One embedded achievements collage, scaled into its tile.
 *
 * `frame` is the collage's OWN clock, not the wall's: it is zero until the camera
 * starts coming down onto this tile, so the collage assembles exactly as it is
 * arrived at — the same staggered fade the achievements composition plays on its
 * own, cued to the camera instead of to the start of the video.
 *
 * Before that the tile is not empty: the collage's sky and clouds carry no
 * animation, so an un-started tile reads as a plain sky plate. Only the
 * polaroids, type and stickers wait, which is what makes the arrival land.
 */
function AchievementTile({
  achievement,
  frame,
  fps,
}: {
  achievement: Achievement;
  frame: number;
  fps: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: ACHIEVEMENTS_CANVAS.w,
        height: ACHIEVEMENTS_CANVAS.h,
        transform: `scale(${ACHIEVEMENTS_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      <AchievementsScene
        // The collage reads title/names/closer off the flat scene shape, so the
        // achievement's own fields are mapped onto the slots it expects.
        data={{
          name: achievement.title,
          subtitle: achievement.names,
          message: achievement.message,
          photoUrl: '',
          // Empty entries fall through to each card's design asset, which is what
          // makes a freshly added achievement render as the original collage.
          photos: achievement.photos,
        }}
        frame={frame}
        fps={fps}
      />
    </div>
  );
}

/**
 * Where the camera has to sit for `index`'s tile to be centred in the frame at
 * `scale`.
 *
 * The camera is `translate(x, y) scale(s)` with the origin at its top-left, so a
 * wall point p lands at `translate + s * p` — solve that for the frame centre and
 * the offset falls out directly. Keeping this as arithmetic rather than as
 * transcribed Figma offsets is what makes the rig independent of wall size.
 */
function cameraPose(wall: Wall, index: number, scale: number) {
  const centre = tileCentre(wall, index);
  return {
    x: CANVAS.w / 2 - scale * centre.x,
    y: CANVAS.h / 2 - scale * centre.y,
    scale,
  };
}

/**
 * A slot with no thumbnail yet: the tile's own box, numbered so it is obvious
 * which short in the panel it corresponds to.
 *
 * Drawn rather than loaded. Figma fills these 132 tiles with placeholder
 * imagery lifted from elsewhere, none of which belongs in this repo, and a
 * committed stand-in image would still be an asset to download mid-capture.
 * Markup has neither problem and cannot desynchronise from the frame.
 */
function PlaceholderTile({ label }: { label?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PLACEHOLDER.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        color: PLACEHOLDER.ink,
      }}
    >
      {/* A play glyph, as a CSS triangle — no asset, no font dependency. */}
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: '90px solid transparent',
          borderBottom: '90px solid transparent',
          borderLeft: `150px solid ${PLACEHOLDER.ink}`,
          opacity: 0.45,
        }}
      />
      {label ? (
        <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</div>
      ) : null}
    </div>
  );
}

/**
 * The "MoreTasks Highlights" card — the one tile that is not a short, and the
 * pose the loop opens and holds on.
 *
 * Markup rather than an exported asset, deliberately. The design's card is a
 * hand-lettered sticker composition this cannot reproduce faithfully, so rather
 * than ship an imitation that would silently pass for the real thing, this is a
 * clean stand-in built from the card's own sampled palette. Supply the real
 * exported artwork through `photoUrl` and it replaces this wholesale.
 */
function HighlightsCard({ src, title }: { src: string; title: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: CARD.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '0 70px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, color: CARD.swoosh, letterSpacing: '-0.01em' }}>
        MoreTasks
      </div>
      {/* Sized so the default "Highlights" clears the tile's edges once the
          camera's slight overscan has cropped it. A much longer headline will
          still run out of room — it wraps rather than spilling off the card. */}
      <div
        style={{
          maxWidth: '100%',
          fontSize: 132,
          fontWeight: 800,
          color: CARD.ink,
          letterSpacing: '-0.03em',
          lineHeight: 1.05,
          textAlign: 'center',
          textTransform: 'uppercase',
          overflowWrap: 'break-word',
        }}
      >
        {title}
      </div>
      {/* The card's underline swoosh, flanked by its two stickers. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <div style={{ width: 62, height: 62, borderRadius: '50% 50% 50% 8%', background: CARD.heart, transform: 'rotate(45deg)' }} />
        <div style={{ width: 520, height: 16, borderRadius: 999, background: CARD.swoosh }} />
        <div style={{ width: 62, height: 62, borderRadius: '8% 50% 50% 50%', background: CARD.arrow, transform: 'rotate(45deg)' }} />
      </div>
    </div>
  );
}

export default function MomentsScene({ data, frame, fps }: SceneProps) {
  const shorts = resolveShorts(data);
  const achievements = resolveAchievements(data);
  const quotes = resolveQuotes(data);
  // Memoised so the timeline below has a stable dependency: the wall only
  // changes when the number of screens does, never when a thumbnail is swapped
  // or a card's text is edited.
  const wall = useMemo(
    () => buildWall(shorts.length, achievements.length, quotes.length),
    [shorts.length, achievements.length, quotes.length],
  );
  const { stops } = wall;
  const cardStop = stops[0];

  /**
   * The flight path: hold on the card, pull back off it, then for each short
   * pan across, zoom in, hold, and zoom back out.
   *
   * Every beat is placed at an absolute time rather than chained, so the gaps
   * between tweens are the holds — GSAP leaves the camera wherever the previous
   * tween left it, which is exactly the "hold" Figma expresses as a pair of
   * equal keyframes.
   */
  const build = useCallback<TimelineBuilder>(
    (tl) => {
      const camera = '[data-motion="camera"]';
      const pose = (index: number, scale: number) => cameraPose(wall, index, scale);

      // No opening `set` here: the camera's rest pose is written as an inline
      // transform below instead. A zero-duration tween parked at time 0 does not
      // render when the timeline is seeked to exactly 0, which left frame 0
      // showing the wall's untransformed top-left corner — a filler tile —
      // rather than the highlights card the loop is supposed to open on.
      let time = INTRO_HOLD_SECONDS;
      tl.to(
        camera,
        { ...pose(cardStop, OVERVIEW_SCALE), duration: PULL_BACK_SECONDS, ease: EASE },
        time,
      );
      time += PULL_BACK_SECONDS;

      // Each hop is a diagonal by construction — consecutive stops always differ
      // in both row and column (see `flightPath`) — so tweening x and y together
      // carries the camera corner to corner rather than straight along an edge.
      for (const stop of stops.slice(1)) {
        tl.to(camera, { ...pose(stop, OVERVIEW_SCALE), duration: PAN_SECONDS, ease: EASE }, time);
        time += PAN_SECONDS;

        tl.to(camera, { ...pose(stop, ZOOM_SCALE), duration: ZOOM_IN_SECONDS, ease: EASE }, time);
        // The hold is the gap before the next tween, not a tween of its own.
        time += ZOOM_IN_SECONDS + HOLD_SECONDS;

        tl.to(camera, { ...pose(stop, OVERVIEW_SCALE), duration: ZOOM_OUT_SECONDS, ease: EASE }, time);
        time += ZOOM_OUT_SECONDS;
      }

      // Home again, landing on exactly the pose the loop started from.
      tl.to(camera, { ...pose(cardStop, OVERVIEW_SCALE), duration: PAN_SECONDS, ease: EASE }, time);
      time += PAN_SECONDS;
      tl.to(camera, { ...pose(cardStop, ZOOM_SCALE), duration: ZOOM_IN_SECONDS, ease: EASE }, time);
    },
    // `wall` is memoised on the short count and the rest comes off it — so this
    // rebuilds only when the wall's shape really changes, not on every frame the
    // preview advances.
    [wall, stops, cardStop],
  );

  const rootRef = useSeekTimeline(build, frame, fps);

  // The camera's rest pose — zoomed onto the highlights card. GSAP tweens from
  // whatever transform it finds here, and seeking back to 0 reverts to it, so
  // this is the single source of the opening frame.
  const rest = cameraPose(wall, cardStop, ZOOM_SCALE);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: CANVAS.w,
        height: CANVAS.h,
        overflow: 'hidden',
        background: WALL_BG,
        fontFamily: 'var(--font-inter), sans-serif',
      }}
    >
      <div
        data-motion="camera"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: wall.w,
          height: wall.h,
          transform: `translate(${rest.x}px, ${rest.y}px) scale(${rest.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {wall.tiles.map((tile, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: tile.x,
              top: tile.y,
              width: TILE.w,
              height: TILE.h,
              overflow: 'hidden',
            }}
          >
            {tile.content.kind === 'card' ? (
              <HighlightsCard src={data.photoUrl} title={data.name || 'Highlights'} />
            ) : tile.content.kind === 'blank' ? (
              // A wall tile the filler pass could not give a short to without
              // breaking the "never repeat a short beside its own stop" rule —
              // reachable in practice whenever there are very few shorts for
              // how many tiles the wall needs to fill (one short is enough to
              // trigger it). Same icon-on-cream treatment as an unfilled short,
              // minus the number, so it reads as an intentional empty slot
              // rather than a broken or missing panel.
              <PlaceholderTile />
            ) : tile.content.kind === 'achievement' ? (
              <AchievementTile
                achievement={achievements[tile.content.index]}
                // Achievements take the stops after the shorts, so this is the
                // screen index the camera schedule is keyed on. Clamped at zero:
                // before the camera arrives the collage sits at its start pose.
                frame={Math.max(
                  0,
                  frame -
                    Math.round(zoomInAt(shorts.length + tile.content.index) * fps),
                )}
                fps={fps}
              />
            ) : tile.content.kind === 'quote' ? (
              <QuoteTile
                quote={quotes[tile.content.index]}
                // Quotes take the stops after the achievements, cued the same way.
                frame={Math.max(
                  0,
                  frame -
                    Math.round(
                      zoomInAt(shorts.length + achievements.length + tile.content.index) * fps,
                    ),
                )}
                fps={fps}
              />
            ) : shorts[tile.content.index] ? (
              <img
                src={shorts[tile.content.index]}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <PlaceholderTile label={`Short ${tile.content.index + 1}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
