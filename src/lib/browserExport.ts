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
 */

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
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

  // WebP keeps alpha (hats, laurels, stickers all rely on it) at a fraction
  // of PNG's size. Same-origin art, so the scratch canvas stays clean.
  return scratch.toDataURL('image/webp', 0.92);
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
        faces.push({ cssText: rule.cssText, base: sheet.href ?? document.baseURI });
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
 * Swaps each `<video>` for an `<img>` holding its currently decoded frame.
 *
 * A `<video>` serializes as markup only — never its pixels — and leaving its
 * URL in would make the SVG reference an external resource and taint the
 * canvas. Substituting an image of the current frame *in place* keeps the
 * element exactly where it sat in the stacking order, which drawing the
 * video separately underneath the rasterized layer does not: birthday's
 * backdrop sits above its root's opaque background, so compositing it behind
 * the frame just painted that background straight over it.
 *
 * JPEG rather than WebP here — the backdrop is opaque, and JPEG encodes
 * markedly faster at this size, which matters since this one runs per frame.
 */
function substituteVideoFrames(clone: HTMLElement, node: HTMLElement): void {
  const live = Array.from(node.querySelectorAll('video'));
  if (live.length === 0) return;

  Array.from(clone.querySelectorAll('video')).forEach((placeholder, index) => {
    const source = live[index];
    const vw = source?.videoWidth ?? 0;
    const vh = source?.videoHeight ?? 0;
    if (!source || !vw || !vh) {
      placeholder.remove();
      return;
    }

    const boxW = source.offsetWidth;
    const boxH = source.offsetHeight;
    const wanted = boxW > 0 && boxH > 0 ? Math.max(boxW / vw, boxH / vh) : 1;
    const scale = Math.min(1, wanted);
    const targetW = Math.max(1, Math.round(vw * scale));
    const targetH = Math.max(1, Math.round(vh * scale));

    const scratch = document.createElement('canvas');
    scratch.width = targetW;
    scratch.height = targetH;
    const sctx = scratch.getContext('2d');
    if (!sctx) {
      placeholder.remove();
      return;
    }
    sctx.drawImage(source, 0, 0, targetW, targetH);

    const image = document.createElement('img');
    image.setAttribute('src', scratch.toDataURL('image/jpeg', 0.85));
    const style = placeholder.getAttribute('style');
    if (style) image.setAttribute('style', style);
    placeholder.replaceWith(image);
  });
}

function serializeFrame(node: HTMLElement, images: ReadonlyMap<string, string>): string {
  const clone = node.cloneNode(true) as HTMLElement;

  applyInheritedVars(clone);
  substituteVideoFrames(clone, node);

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

  // The SVG wrapper is identical every frame, so build its two halves once
  // and only concatenate the changing markup between them.
  const svgHead =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">` +
    `<style xmlns="http://www.w3.org/1999/xhtml">${fontCss}</style>`;
  const svgTail = `</foreignObject></svg>`;

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: new Quality('high') });
  output.addVideoTrack(videoSource);
  await output.start();

  const t = { seek: 0, video: 0, serialize: 0, raster: 0, draw: 0, encode: 0 };
  const mark = () => performance.now();
  const t0 = mark();

  /** How many encodes may be in flight before the loop waits for one. */
  const ENCODE_QUEUE_DEPTH = 6;
  const inFlight: Promise<unknown>[] = [];

  for (let i = 0; i < durationInFrames; i += 1) {
    let a = mark();
    seekTo(i);
    t.seek += mark() - a;

    a = mark();
    await seekRegisteredVideos(i);
    t.video += mark() - a;

    a = mark();
    const markup = svgHead + serializeFrame(node, images) + svgTail;
    t.serialize += mark() - a;

    a = mark();
    const frameImage = await rasterize(markup);
    t.raster += mark() - a;

    a = mark();
    ctx.clearRect(0, 0, width, height);
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
  };
  console.log('[export perf]', JSON.stringify(stats));
  (window as unknown as { __exportPerf?: unknown }).__exportPerf = stats;

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('No output buffer produced');
  return new Blob([buffer], { type: 'video/mp4' });
}
