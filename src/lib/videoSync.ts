/**
 * Keeps `<video>` backgrounds in lockstep with the frame being rendered.
 *
 * A playing video is wall-clock driven, which is exactly what the capture
 * pipeline forbids: `scripts/render.mjs` screenshots frame by frame, so a video
 * left to play would land at a different position on every run and the
 * determinism check would fail. Instead nothing ever plays — each scene
 * registers a seeker here, and the renderer drives `currentTime` from the frame
 * number and waits for the browser to actually decode that position before it
 * screenshots.
 */

export type FrameSeeker = (frame: number) => Promise<void>;

const seekers = new Set<FrameSeeker>();

/**
 * How long to wait on a media event before giving up on it.
 *
 * Every wait here is bounded on purpose. A `seeked` or `loadeddata` that never
 * arrives — a stalled decode, a half-downloaded file — would otherwise hang the
 * render forever with no output and no error. Falling through leaves the video
 * a frame or two stale, which is a far better failure than a capture that never
 * finishes.
 */
const MEDIA_TIMEOUT_MS = 10_000;

function withTimeout(attach: (done: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, MEDIA_TIMEOUT_MS);
    attach(done);
  });
}

/** Registers a seeker for the render loop to drive. Returns an unsubscribe. */
export function registerFrameSeeker(seeker: FrameSeeker): () => void {
  seekers.add(seeker);
  return () => {
    seekers.delete(seeker);
  };
}

/** Resolves once every registered video has decoded the given frame. */
export async function seekRegisteredVideos(frame: number): Promise<void> {
  await Promise.all(Array.from(seekers, (seek) => seek(frame)));
}

/**
 * Seeks one video to a frame, looping if the clip is shorter than the scene.
 *
 * Resolves immediately when the element is already within half a frame of the
 * target: re-seeking to the position it already holds would never fire
 * `seeked`, and the promise would hang the whole render.
 */
export function seekVideoToFrame(
  video: HTMLVideoElement,
  frame: number,
  fps: number,
): Promise<void> {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return Promise.resolve();

  // Aim at the MIDDLE of the target frame, not its boundary. Seeking to an
  // exact boundary is ambiguous — the decoder can round to either neighbouring
  // frame, so the same composition frame decodes differently between runs and
  // the render stops being reproducible. Half a frame in, there is only one
  // possible answer.
  const target = ((frame + 0.5) / fps) % duration;
  if (Math.abs(video.currentTime - target) < 0.25 / fps) return Promise.resolve();

  return withTimeout((done) => {
    // A decode error must not stall the render — a missing background is far
    // less bad than a capture that never finishes.
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', done, { once: true });
    video.currentTime = target;
  });
}

/** Resolves once a video has enough data that seeking will actually paint. */
export function whenVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) return Promise.resolve();
  if (video.error) return Promise.resolve();
  return withTimeout((done) => {
    video.addEventListener('loadeddata', done, { once: true });
    video.addEventListener('error', done, { once: true });
  });
}
