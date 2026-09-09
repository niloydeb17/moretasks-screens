/**
 * Sequential video decode for the exporter.
 *
 * WHY NOT JUST SEEK THE `<video>`
 *
 * The original path drove each `<video>` with `currentTime = t` and awaited
 * `seeked`, once per exported frame (see `./videoSync`, which still does
 * exactly that for the live preview — where it is the right tool). A seek is
 * not a cheap operation: the browser throws away the decoder's state, hunts
 * backwards to the nearest keyframe, and re-decodes forward to the requested
 * position. Stepping through a clip frame by frame therefore re-decodes most
 * of every GOP once per frame, and the cost scales with keyframe spacing
 * rather than with the single frame actually wanted.
 *
 * Measured on the birthday scene that was 44.5ms of a 74.6ms frame — 60% of
 * the entire export — spent seeking a video that only ever moves forwards.
 *
 * Mediabunny is already a dependency (it muxes the output MP4), and it can
 * demux and decode the input just as well. Handing it every timestamp up
 * front lets it run one forward decode pass over the clip:
 * `samplesAtTimestamps` decodes each packet at most once for monotonically
 * sorted input. So the whole export costs roughly one decode of the footage
 * instead of one seek per frame.
 *
 * The feed owns the whole per-frame pipeline (decode, scale, encode) rather
 * than handing frames out, for two reasons: the scratch canvas is allocated
 * once instead of once per frame, and every decoded sample is closed the
 * moment it has been drawn. A `VideoSample` wraps a real `VideoFrame`, and
 * the decoder recycles a small pool of those — retaining one per frame
 * exhausts the pool and stalls the export outright.
 */

import { ALL_FORMATS, Input, UrlSource, VideoSampleSink, type VideoSample } from 'mediabunny';

export interface VideoFrameFeed {
  /** Decoded frame size, for the caller's `cover` maths. */
  readonly width: number;
  readonly height: number;
  /**
   * The next frame in the sequence, as something `drawImage` accepts.
   *
   * Handed over rather than pre-drawn into a scratch canvas so the caller can
   * blit it exactly once, straight to wherever it belongs. A decoded frame at
   * this resolution is 2 megapixels; an intermediate canvas would double that
   * cost for nothing.
   *
   * Valid only until the next `next()` or `close()`, which release the
   * underlying `VideoFrame` — the decoder recycles a small pool of those, and
   * retaining one per frame exhausts the pool and stalls the export.
   *
   * Null when the clip has nothing at that timestamp or the decode failed —
   * the caller treats that like a video it could not read at all, so a broken
   * backdrop never takes the whole export down with it.
   */
  next(): Promise<CanvasImageSource | null>;
  close(): void;
}

/**
 * Opens a forward-only feed of encoded frames for one clip.
 *
 * Timestamps are computed here rather than taken from the caller so they stay
 * identical to what the seeking path produced — the middle of each frame
 * (unambiguous, unlike a boundary that can round either way), looping when the
 * clip is shorter than the composition. Exported footage therefore sits at
 * exactly the same position as it did before this optimization.
 *
 * Returns null rather than throwing if the file can't be read, letting the
 * caller fall back to reading pixels off the live `<video>`.
 */
export async function openVideoFrameFeed(
  src: string,
  frameCount: number,
  fps: number,
): Promise<VideoFrameFeed | null> {
  try {
    const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input.dispose();
      return null;
    }

    const duration = await input.computeDuration();
    const natW = track.displayWidth;
    const natH = track.displayHeight;
    if (!Number.isFinite(duration) || duration <= 0 || !natW || !natH) {
      input.dispose();
      return null;
    }

    const timestamps: number[] = [];
    for (let i = 0; i < frameCount; i += 1) {
      timestamps.push(((i + 0.5) / fps) % duration);
    }

    // Left on the default `no-preference`: measured against
    // `prefer-hardware` on this footage there was no difference (29.5ms vs
    // 29.9ms per frame), so the browser is already picking the right decoder
    // and pinning the hint would only remove its freedom to choose.
    const sink = new VideoSampleSink(track);
    const samples = sink.samplesAtTimestamps(timestamps);

    // Held so the *previous* frame can be released on the way into the next
    // one: the caller needs it to stay alive for the whole iteration it was
    // handed out in, but no longer than that.
    let open: VideoSample | null = null;
    const release = () => {
      open?.close();
      open = null;
    };

    return {
      width: natW,
      height: natH,
      async next() {
        release();
        try {
          const { value, done } = await samples.next();
          if (done || !value) return null;
          open = value;
          return value.toCanvasImageSource();
        } catch {
          return null;
        }
      },
      close() {
        release();
        void samples.return(undefined);
        input.dispose();
      },
    };
  } catch {
    return null;
  }
}
