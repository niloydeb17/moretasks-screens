/**
 * Exports a scene to an MP4 entirely in the browser — no Puppeteer, no
 * ffmpeg, no server round-trip. The same shape as Jitter's own exporter
 * ("runs primarily in your browser", per their help docs): rasterize each
 * seeked frame to a canvas, then encode it with the browser's own WebCodecs
 * `VideoEncoder` via Mediabunny.
 *
 * WHY THIS IS HAND-ROLLED RATHER THAN `html-to-image`
 *
 * Measured on the achievements scene (150 frames, 42 DOM nodes, 12 images),
 * `html-to-image.toCanvas` cost 185.9ms of a 191ms frame — 97% of the entire
 * export. The other phases were already negligible: WebCodecs encode 0.2ms,
 * canvas draw 1.2ms, React+GSAP seek 3.6ms.
 *
 * That 186ms is not the computed-style walk people usually blame (42 nodes is
 * nothing). It is that the library re-fetches and re-base64-encodes every
 * image *and every font* on every single frame — here, 12 images x 150 frames
 * of redundant work for assets that never change.
 *
 * So the expensive parts are hoisted out of the loop and done exactly once:
 * images and fonts are fetched and inlined a single time up front, and each
 * frame only pays for a DOM clone, an XML serialize, and one image decode.
 * See `docs` in `prepareAssets` for the caching contract.
 *
 * WHAT IS STILL PAID PER FRAME, AND WHAT IS DONE ABOUT IT
 *
 * An SVG loaded through an `<img>` is sandboxed, so inlined bytes cannot be
 * cached across frames — the browser re-decodes every embedded asset for
 * every frame, and that decode is now the dominant cost. Two things keep it
 * down: opaque images are inlined as JPEG rather than WebP (see
 * `reencodeAtDisplaySize`), and full-plate video backdrops skip the SVG
 * altogether, painted straight onto the canvas underneath the rasterized
 * layer wherever that is provably safe (see `planCompositedVideo`).
 *
 * Video is decoded sequentially rather than by seeking — see
 * `./exportVideoDecode`, which was the single largest win of the lot.
 */

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import { openVideoFrameFeed, type VideoFrameFeed } from './exportVideoDecode';
import { seekRegisteredVideos } from './videoSync';

export interface BrowserExportOptions {
  /** The scene's own root DOM node, unscaled, at its native canvas size. */
  node: HTMLElement;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Synchronously updates the scene to show this frame (caller wraps in `flushSync`). */
  seekTo: (frame: number) => void;
  onProgress?: (framesDone: number, totalFrames: number) => void;
}

/** Thrown when the browser can't do WebCodecs-based encoding at all. */
export class BrowserExportUnsupportedError extends Error {}

export function isBrowserExportSupported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read export asset'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to prepare export asset (${response.status}): ${url}`);
  return blobToDataUrl(await response.blob());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load export image: ${src}`));
    img.src = src;
  });
}

/**
 * True when every pixel in the canvas is fully opaque.
 *
 * This decides the inlining codec below, so it has to be about the actual
 * pixels rather than the source file's extension — a `.webp` or `.png` may or
 * may not really use its alpha channel, and guessing wrong either wastes
 * decode time or silently flattens transparency to black. Runs once per image
 * per export (never per frame), so a full scan is affordable.
 */
function isFullyOpaque(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) return false;
    }
    return true;
  } catch {
    // Unreadable for any reason: assume transparency. WebP is correct either
    // way, just slower to decode, so this fails safe rather than lossy.
    return false;
  }
}

/**
 * Re-encodes an image at the size it is actually painted at.
 *
 * This is the single biggest win in the whole exporter. Every image has to
 * be inlined into the SVG as a data: URI (an SVG rendered through an <img>
 * is sandboxed and cannot fetch anything), and the browser re-decodes every
 * one of those on *every frame*. The source art is far larger than its slot
 * — `sky.webp` is 2.7MB feeding a few-hundred-pixel box — so decoding the
 * originals 150+ times is where the export time went.
 *
 * Downscaling to the painted box first cuts that decode by orders of
 * magnitude, and shrinks the serialized SVG string just as much. Aspect
 * ratio is preserved and the image is never upscaled, so `object-fit: cover`
 * crops exactly as it does on screen and nothing gets softer than it was.
 */
async function reencodeAtDisplaySize(src: string, boxW: number, boxH: number): Promise<string> {
  const img = await loadImage(src);
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return fetchAsDataUrl(src);

  // `cover` needs the larger of the two ratios; clamped to 1 so a small
  // source is never blown up. A zero box (unmeasurable) keeps full size.
  const wanted = boxW > 0 && boxH > 0 ? Math.max(boxW / natW, boxH / natH) : 1;
  const scale = Math.min(1, wanted);
  const targetW = Math.max(1, Math.round(natW * scale));
  const targetH = Math.max(1, Math.round(natH * scale));

  const scratch = document.createElement('canvas');
  scratch.width = targetW;
  scratch.height = targetH;
  const sctx = scratch.getContext('2d');
  if (!sctx) return fetchAsDataUrl(src);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(img, 0, 0, targetW, targetH);

  // Codec choice here is a *decode-speed* decision, and it is paid on every
  // frame: each frame builds a fresh SVG document, so the browser
  // base64-decodes and image-decodes every inlined asset again from scratch.
  // Nothing can be cached across frames — an SVG loaded through an <img> is
  // sandboxed, so the bytes must be inline — which makes the per-image decode
  // cost the dominant term in the whole export. On the achievements scene
  // (12 images) that phase measured 39.9ms of a 48.4ms frame.
  //
  // JPEG decodes several times faster than WebP (libjpeg-turbo's SIMD path
  // versus libwebp), so opaque art — every photo and backdrop here — takes
  // the fast codec. WebP is kept only where it earns its cost: images that
  // genuinely use their alpha channel (hats, laurels, stickers), which JPEG
  // cannot represent at all. Same-origin art, so the scratch stays clean.
  return isFullyOpaque(scratch, sctx)
    ? scratch.toDataURL('image/jpeg', 0.9)
    : scratch.toDataURL('image/webp', 0.92);
}

interface PreparedAssets {
  /** Absolute image URL -> data: URI. */
  images: ReadonlyMap<string, string>;
  /** `@font-face` CSS with every `url()` already inlined as a data: URI. */
  fontCss: string;
}

/**
 * Fetches every external asset the scene references and inlines it — once
 * per export, not once per frame.
 *
 * This is the whole optimization. An SVG rendered through an `<img>` is
 * sandboxed: it cannot load external URLs, so every image and font *must*
 * end up inlined as a data: URI for the frame to rasterize correctly. Doing
 * that per frame is what made the naive version 186ms/frame; doing it once
 * and reusing the strings is what makes it fast.
 */
async function prepareAssets(node: HTMLElement): Promise<PreparedAssets> {
  const cache = new Map<string, Promise<string>>();
  const embed = (rawUrl: string, base: string) => {
    const absolute = new URL(rawUrl, base).href;
    const pending = cache.get(absolute) ?? fetchAsDataUrl(absolute);
    cache.set(absolute, pending);
    return pending;
  };

  // One entry per unique src, sized to the largest box any element paints it
  // into — two elements can share art at different sizes, and the bigger one
  // decides the resolution so neither ends up soft.
  const needed = new Map<string, { w: number; h: number }>();
  for (const image of Array.from(node.querySelectorAll('img'))) {
    const source = image.getAttribute('src');
    if (!source || source.startsWith('data:')) continue;
    const absolute = new URL(source, document.baseURI).href;
    const prev = needed.get(absolute);
    needed.set(absolute, {
      w: Math.max(prev?.w ?? 0, image.offsetWidth),
      h: Math.max(prev?.h ?? 0, image.offsetHeight),
    });
  }

  const images = new Map<string, string>();
  await Promise.all(
    Array.from(needed, async ([absolute, box]) => {
      try {
        images.set(absolute, await reencodeAtDisplaySize(absolute, box.w, box.h));
      } catch {
        // Fall back to the untouched bytes rather than dropping the image.
        images.set(absolute, await embed(absolute, document.baseURI));
      }
    }),
  );

  // next/font self-hosts every face this project uses (see layout.tsx), so
  // the stylesheets are same-origin and readable. A cross-origin sheet would
  // throw on `.cssRules` and is simply skipped rather than failing the export.
  //
  // Each face is kept with its own stylesheet href: next/font emits
  // `url(../media/…)`, which is relative to the *stylesheet*, not the
  // document. Resolving those against `document.baseURI` silently 404s and
  // leaves an external URL in the CSS — which taints the canvas and makes
  // WebCodecs refuse the frame outright.
  const faces: { cssText: string; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        faces.push({
          cssText: rule.cssText,
          base: sheet.href ?? document.baseURI,
        });
      }
    }
  }

  const fontCss = (
    await Promise.all(
      faces.map(async ({ cssText, base }) => {
        const urls = Array.from(cssText.matchAll(/url\((['"]?)([^'")]+)\1\)/g));
        let out = cssText;
        for (const [full, , rawUrl] of urls) {
          if (rawUrl.startsWith('data:')) continue;
          try {
            out = out.replace(full, `url("${await embed(rawUrl, base)}")`);
          } catch {
            // Drop the reference rather than leaving it external. An
            // unreachable font just falls back to a system face; an external
            // URL left in the markup taints the canvas and fails the export.
            out = out.replace(full, 'url("data:font/woff2;base64,")');
          }
        }
        return out;
      }),
    )
  ).join('\n');

  return { images, fontCss };
}

/**
 * Serializes the scene as XHTML suitable for embedding in an SVG.
 *
 * `outerHTML` is not usable here: the markup is parsed as XML inside the SVG,
 * and HTML serialization emits void elements as `<img>` rather than the
 * `<img />` XML requires — any scene containing one would fail to decode.
 * `XMLSerializer` keeps the HTML namespace while emitting well-formed XHTML.
 */
/**
 * CSS custom properties the scene inherits from outside the captured node.
 *
 * The scenes set `fontFamily: 'var(--font-inter), sans-serif'`, but next/font
 * defines `--font-inter` on `<html>` — which is *not* inside the cloned
 * subtree. Inside the SVG the variable resolves to nothing and every glyph
 * silently falls back to the system sans, changing the typeface in the
 * export. Copying the resolved values onto the clone's root restores them by
 * normal inheritance.
 */
const INHERITED_CSS_VARS = ['--font-inter', '--font-hedvig'] as const;

function applyInheritedVars(clone: HTMLElement): void {
  const rootStyle = getComputedStyle(document.documentElement);
  for (const name of INHERITED_CSS_VARS) {
    const value = rootStyle.getPropertyValue(name);
    if (value) clone.style.setProperty(name, value);
  }
}

/**
 * Takes each `<video>` out of the clone, one of two ways.
 *
 * A `<video>` serializes as markup only — never its pixels — and leaving its
 * URL in would make the SVG reference an external resource and taint the
 * canvas, so every one of them has to go.
 *
 * Clips the caller is compositing (see `planCompositedVideo`) are simply
 * removed: their pixels go straight onto the export canvas underneath this
 * layer. Everything else gets an `<img>` of the current frame substituted
 * *in place*, which keeps the element exactly where it sat in the stacking
 * order — the reason this is worth doing at all, because drawing such a video
 * behind the rasterized layer would put it under anything painted above it.
 */
function substituteVideoFrames(
  clone: HTMLElement,
  node: HTMLElement,
  frames: readonly (CanvasImageSource | null)[],
  composited: readonly (CompositedVideo | null)[],
): void {
  const live = Array.from(node.querySelectorAll('video'));
  if (live.length === 0) return;

  Array.from(clone.querySelectorAll('video')).forEach((placeholder, index) => {
    // Painted straight onto the canvas by the caller — it must leave no
    // element behind here, or the SVG would draw over the top of it.
    if (composited[index]) {
      placeholder.remove();
      return;
    }

    const source = live[index];
    if (!source) {
      placeholder.remove();
      return;
    }

    // Only clips that can't be composited reach here. A decoded frame still
    // has to be encoded into the markup; clips the demuxer could not open at
    // all fall back to the live element, so an awkward file degrades to the
    // old (slower) behaviour rather than vanishing from the export.
    const frame = frames[index];
    const dataUrl = encodeFrameForMarkup(frame ?? source, source);
    if (!dataUrl) {
      placeholder.remove();
      return;
    }

    const image = document.createElement('img');
    image.setAttribute('src', dataUrl);
    const style = placeholder.getAttribute('style');
    if (style) image.setAttribute('style', style);
    placeholder.replaceWith(image);
  });
}

/**
 * Where a video sits inside the captured node, so it can be painted straight
 * onto the export canvas instead of being routed through the SVG.
 */
interface CompositedVideo {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Background colours of every ancestor between the captured node and the
   * video, outermost first. These paint beneath it, so the canvas has to
   * reproduce them before the frame goes down — and the clone has to drop
   * them so the rasterized layer doesn't paint them straight back over it.
   */
  backgrounds: string[];
}

/**
 * Decides whether a video can skip the SVG entirely.
 *
 * Round-tripping a backdrop through the SVG is expensive in a way nothing
 * else is: the frame has to be JPEG-encoded into a data: URI and then
 * immediately JPEG-decoded again by the browser, twice over a full 1080x1920
 * plate, every single frame. Drawing it onto the canvas directly skips both.
 *
 * It is only *correct* to do that when nothing in the scene paints beneath
 * the video — otherwise whatever sits below it would end up on top. That
 * holds when the video is the first element child at every level up to the
 * captured node (so only those ancestors' own backgrounds are behind it),
 * none of them uses a background image a `fillRect` can't reproduce, and
 * nothing in the subtree pulls itself below with a negative z-index.
 *
 * The walk goes all the way up rather than checking one parent because the
 * captured node is the exporter's own wrapper, not the scene's root — the
 * scene root (which carries the opaque background) sits in between.
 *
 * Anything failing these tests keeps the inlined path: slower, always right.
 */
function planCompositedVideo(node: HTMLElement, video: HTMLVideoElement): CompositedVideo | null {
  const ancestors: HTMLElement[] = [];
  let current: HTMLElement = video;
  while (current !== node) {
    const parent = current.parentElement;
    if (!parent || parent.firstElementChild !== current) return null;
    ancestors.push(parent);
    current = parent;
  }
  if (ancestors.length === 0) return null;
  ancestors.reverse();

  for (const ancestor of ancestors) {
    if (getComputedStyle(ancestor).backgroundImage !== 'none') return null;
  }

  for (const element of Array.from(node.querySelectorAll('*'))) {
    const z = getComputedStyle(element).zIndex;
    if (z !== 'auto' && Number(z) < 0) return null;
  }

  const rootRect = node.getBoundingClientRect();
  const rect = video.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  return {
    x: rect.left - rootRect.left,
    y: rect.top - rootRect.top,
    w: rect.width,
    h: rect.height,
    backgrounds: ancestors.map((a) => getComputedStyle(a).backgroundColor),
  };
}

/* `CanvasImageSource` is a union whose members spell their size differently —
   a decoded `VideoFrame` uses `displayWidth`, canvases use `width`. */
function sourceWidth(frame: CanvasImageSource): number {
  if ('displayWidth' in frame) return frame.displayWidth;
  if ('width' in frame) return typeof frame.width === 'number' ? frame.width : 0;
  return 0;
}

function sourceHeight(frame: CanvasImageSource): number {
  if ('displayHeight' in frame) return frame.displayHeight;
  if ('height' in frame) return typeof frame.height === 'number' ? frame.height : 0;
  return 0;
}

/** Paints a frame into a box with `object-fit: cover` semantics. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  frameW: number,
  frameH: number,
  box: CompositedVideo,
): void {
  const scale = Math.max(box.w / frameW, box.h / frameH);
  const w = frameW * scale;
  const h = frameH * scale;
  ctx.drawImage(frame, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

/**
 * Scales a frame into its element's box and encodes it for the markup.
 *
 * Only videos that failed the compositing test come through here, so this is
 * the slow path by construction: it pays a full-resolution JPEG encode (and
 * the browser a matching decode) on every frame. `layout` supplies the
 * painted box; `frame` is either a decoded sample or, for clips the demuxer
 * could not open at all, the live `<video>` itself.
 */
function encodeFrameForMarkup(
  frame: CanvasImageSource,
  layout: HTMLVideoElement,
): string | null {
  const vw = frame instanceof HTMLVideoElement ? frame.videoWidth : sourceWidth(frame);
  const vh = frame instanceof HTMLVideoElement ? frame.videoHeight : sourceHeight(frame);
  if (!vw || !vh) return null;

  const boxW = layout.offsetWidth;
  const boxH = layout.offsetHeight;
  const wanted = boxW > 0 && boxH > 0 ? Math.max(boxW / vw, boxH / vh) : 1;
  const scale = Math.min(1, wanted);
  const targetW = Math.max(1, Math.round(vw * scale));
  const targetH = Math.max(1, Math.round(vh * scale));

  const scratch = document.createElement('canvas');
  scratch.width = targetW;
  scratch.height = targetH;
  const sctx = scratch.getContext('2d');
  if (!sctx) return null;
  sctx.drawImage(frame, 0, 0, targetW, targetH);
  return scratch.toDataURL('image/jpeg', 0.85);
}

function serializeFrame(
  node: HTMLElement,
  images: ReadonlyMap<string, string>,
  videoFrames: readonly (CanvasImageSource | null)[],
  composited: readonly (CompositedVideo | null)[],
): string {
  const clone = node.cloneNode(true) as HTMLElement;

  applyInheritedVars(clone);

  // Those ancestor backgrounds are already on the canvas, beneath the
  // composited video. Leaving them here would paint them straight back over
  // it when this layer is drawn on top. Cleared before the video is removed
  // below, while the first-child chain still leads to it.
  for (const plan of composited) {
    if (!plan) continue;
    let cursor: Element | null = clone;
    for (let depth = 0; depth < plan.backgrounds.length && cursor; depth += 1) {
      (cursor as HTMLElement).style.background = 'transparent';
      cursor = cursor.firstElementChild;
    }
  }

  substituteVideoFrames(clone, node, videoFrames, composited);

  clone.querySelectorAll('img').forEach((image) => {
    const source = image.getAttribute('src');
    if (!source || source.startsWith('data:')) return;
    const embedded = images.get(new URL(source, document.baseURI).href);
    if (embedded) image.setAttribute('src', embedded);
  });

  return new XMLSerializer().serializeToString(clone);
}

/**
 * Rasterizes one frame's SVG into a decoded image.
 *
 * The `data:` URL here is load-bearing and must not be "optimized" into a
 * `blob:` URL. Chromium marks a canvas tainted when it draws an SVG image
 * containing a `<foreignObject>` loaded from a blob: URL — even one with no
 * external references at all — and a tainted canvas makes WebCodecs reject
 * every frame with "VideoFrames can't be created from tainted sources".
 * The same markup loaded from a data: URL stays origin-clean. Verified
 * directly in-browser: blob+foreignObject tainted, data+foreignObject clean.
 */
function rasterize(svgMarkup: string): Promise<HTMLImageElement> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize frame'));
    img.src = url;
  });
}

export async function exportSceneToMp4({
  node,
  width,
  height,
  fps,
  durationInFrames,
  seekTo,
  onProgress,
}: BrowserExportOptions): Promise<Blob> {
  if (!isBrowserExportSupported()) {
    throw new BrowserExportUnsupportedError(
      'This browser has no WebCodecs support — try the latest Chrome or Edge.',
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas context unavailable');

  const { images, fontCss } = await prepareAssets(node);

  // One decode feed per `<video>`, walked in the same order
  // `substituteVideoFrames` walks the clone's elements. See
  // `./exportVideoDecode` for why this replaces a seek per frame.
  const liveVideos = Array.from(node.querySelectorAll('video'));
  const feeds: (VideoFrameFeed | null)[] = await Promise.all(
    liveVideos.map((video) => {
      const source = video.getAttribute('src');
      if (!source) return Promise.resolve(null);
      return openVideoFrameFeed(new URL(source, document.baseURI).href, durationInFrames, fps);
    }),
  );

  // With a feed driving that element, the live `<video>` is dead weight — but
  // not free: the scene's own layout effect still fires a seek for every
  // frame the export steps through, and those run on the media thread
  // competing with the decoder for nothing. Dropping the source makes
  // `seekVideoToFrame` bail immediately (no finite duration), which stops the
  // seeks without the scene needing to know an export is running.
  feeds.forEach((feed, index) => {
    if (feed) liveVideos[index].removeAttribute('src');
  });

  // Which of those can bypass the SVG altogether (see `planCompositedVideo`).
  // Only clips with a working feed qualify: the fallback reads pixels off the
  // live element, which has just had its source removed.
  const composited = liveVideos.map((video, index) =>
    feeds[index] ? planCompositedVideo(node, video) : null,
  );
  const hasComposited = composited.some(Boolean);

  // The SVG wrapper is identical every frame, so build its two halves once
  // and only concatenate the changing markup between them.
  const svgHead =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<style xmlns="http://www.w3.org/1999/xhtml">${fontCss}</style>`;
  const svgTail = `</foreignObject></svg>`;

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: new Quality('high'),
  });
  output.addVideoTrack(videoSource);
  await output.start();

  const t = { seek: 0, video: 0, serialize: 0, raster: 0, draw: 0, encode: 0 };
  const mark = () => performance.now();
  const t0 = mark();

  /** How many encodes may be in flight before the loop waits for one. */
  const ENCODE_QUEUE_DEPTH = 6;
  const inFlight: Promise<unknown>[] = [];

  try {
    for (let i = 0; i < durationInFrames; i += 1) {
      let a = mark();
      seekTo(i);
      t.seek += mark() - a;

      a = mark();
      const videoFrames = await Promise.all(feeds.map((feed) => feed?.next() ?? null));
      // Still driven for any scene that registers a seeker the feeds don't
      // cover; a no-op once the videos above have been made inert.
      await seekRegisteredVideos(i);
      t.video += mark() - a;

      a = mark();
      const markup = svgHead + serializeFrame(node, images, videoFrames, composited) + svgTail;
      t.serialize += mark() - a;

      a = mark();
      const frameImage = await rasterize(markup);
      t.raster += mark() - a;

      a = mark();
      ctx.clearRect(0, 0, width, height);
      // Composited backdrops go down first, under the rasterized layer: the
      // scene's own background, then the video, then everything the SVG
      // draws — the same order the DOM paints them in.
      if (hasComposited) {
        composited.forEach((plan, index) => {
          if (!plan) return;
          for (const background of plan.backgrounds) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);
          }
          const frame = videoFrames[index];
          const feed = feeds[index];
          if (frame && feed) drawCover(ctx, frame, feed.width, feed.height, plan);
        });
      }
      ctx.drawImage(frameImage, 0, 0, width, height);
      t.draw += mark() - a;

      // Don't await every frame: the encoder runs on its own thread, so
      // blocking on each one serializes hardware encode against the next
      // frame's rasterization instead of overlapping them. A short queue keeps
      // the encoder fed while still applying backpressure, so a long export
      // can't buffer unbounded frames into memory.
      a = mark();
      inFlight.push(videoSource.add(i / fps, 1 / fps));
      if (inFlight.length >= ENCODE_QUEUE_DEPTH) await inFlight.shift();
      t.encode += mark() - a;

      onProgress?.(i + 1, durationInFrames);
    }
    await Promise.all(inFlight);
  } finally {
    // Release the demuxers and their canvas pools even if the export threw
    // partway through, so a failed attempt doesn't strand decoder resources.
    feeds.forEach((feed) => feed?.close());
  }

  const total = mark() - t0;
  const per = (v: number) => +(v / durationInFrames).toFixed(1);
  const stats = {
    frames: durationInFrames,
    totalSec: +(total / 1000).toFixed(2),
    fps: +(durationInFrames / (total / 1000)).toFixed(2),
    msPerFrame: {
      seek: per(t.seek),
      video: per(t.video),
      serialize: per(t.serialize),
      raster: per(t.raster),
      draw: per(t.draw),
      encode: per(t.encode),
    },
    domNodes: node.querySelectorAll('*').length,
    images: node.querySelectorAll('img').length,
    // `videos` counts the `<video>` elements found; `decodedFeeds` how many
    // of them the demuxer actually took over. A gap between the two means
    // clips fell back to per-frame seeking, which is the slow path — worth
    // seeing in the log rather than inferring from a disappointing number.
    videos: liveVideos.length,
    decodedFeeds: feeds.filter(Boolean).length,
  };
  console.log('[export perf]', JSON.stringify(stats));
  (window as unknown as { __exportPerf?: unknown }).__exportPerf = stats;

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('No output buffer produced');
  return new Blob([buffer], { type: 'video/mp4' });
}
