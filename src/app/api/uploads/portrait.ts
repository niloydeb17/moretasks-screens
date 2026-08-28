import sharp, { type Sharp } from 'sharp';

/**
 * Turns an uploaded photo into the shape the MVP card was designed around.
 *
 * The card's portrait is not a photo in a frame. The design's own asset is a
 * greyscale, background-removed cut-out sitting in the bottom band of a mostly
 * empty 941x1672 canvas, and Figma's crop transform on the card was authored to
 * frame exactly that band. Feed an ordinary photo through the same transform and
 * it shows the person's waist, in colour, on whatever wall they were standing in
 * front of — which is the hand-editing this module exists to remove.
 *
 * So the output here is deliberately not "a nicer crop of your photo". It is the
 * design's asset shape: same canvas, same band, same greyscale, alpha where the
 * background used to be. That is what lets the card stay completely unchanged.
 *
 * Four steps, each of which can fall back without failing the upload:
 *
 *   1. cut the background out          (remove.bg, the one network call)
 *   2. desaturate                      (sharp)
 *   3. find where the chest is         (the alpha channel's width profile)
 *   4. composite into the design band  (sharp)
 *
 * WHERE THE PHOTO GOES. Step 1 sends the image to remove.bg, a third party. That
 * is a deliberate choice made by the person running this tool, not a default —
 * the alternatives were a local model or a border heuristic, and this one was
 * picked for edge quality. It is worth being blunt in this comment because the
 * consequence is not visible from the call site: every portrait uploaded with
 * treatment on leaves this machine. `REMOVE_BG_API_KEY` being unset is therefore
 * a hard stop for step 1 rather than something to work around — no key means no
 * upload to anyone, and the rest of the pipeline still runs.
 */

/** The design's portrait canvas, and the band inside it the card actually shows. */
const CANVAS = { w: 941, h: 1672 } as const;
const BAND = { y: 753, h: 919 } as const;

/**
 * How far below the crown the chest sits, in head-heights.
 *
 * The classical figure-drawing proportion is 7.5 heads to the whole body, with
 * the chest a little under 3 heads down. 2.6 keeps the shoulders complete and
 * stops before the waist, which is what "crop till chest" means on this card.
 */
const CHEST_IN_HEADS = 2.6;

/** Alpha at or above this counts as subject rather than background. */
const SOLID = 128;

export interface TreatedPortrait {
  buffer: Buffer;
  /** False when the cut-out step was skipped or failed — the caller surfaces it. */
  backgroundRemoved: boolean;
  /** Why the background is still there, when it is. */
  note?: string;
}

/**
 * Sends the image to remove.bg and returns an RGBA cut-out.
 *
 * Returns null rather than throwing on every foreseeable failure — no key, a
 * refused key, an exhausted quota, no network. A portrait that still has its
 * background is a far better outcome than an upload that fails outright, and the
 * caller reports which happened.
 */
async function cutOutBackground(
  input: Buffer,
): Promise<{ buffer: Buffer } | { error: string }> {
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) {
    return { error: 'REMOVE_BG_API_KEY is not set, so the background was left in place.' };
  }

  const form = new FormData();
  form.append('image_file', new Blob([new Uint8Array(input)]), 'upload');
  // `size=full` keeps the source resolution; the framing below needs the detail.
  form.append('size', 'full');
  form.append('format', 'png');

  let response: Response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return { error: `Could not reach remove.bg (${why}); the background was left in place.` };
  }

  if (!response.ok) {
    // remove.bg reports quota and key problems in the body; pass its own words
    // through rather than inventing a summary of them.
    const detail = await response.text().catch(() => '');
    const first = detail.slice(0, 300).replace(/\s+/g, ' ').trim();
    return {
      error: `remove.bg refused the image (HTTP ${response.status}${first ? `: ${first}` : ''}); the background was left in place.`,
    };
  }

  return { buffer: Buffer.from(await response.arrayBuffer()) };
}

interface Silhouette {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Row the chest sits on, already clamped inside the subject. */
  chest: number;
}

/**
 * Reads the subject's outline out of the alpha channel and works out where to
 * cut.
 *
 * The width profile of a person's silhouette has a shape worth exploiting: it
 * grows from the crown, peaks around the ears, pinches at the neck, then jumps
 * outward at the shoulders. So the first pinch after the first peak IS the neck,
 * which gives a head height without needing a face detector — and a head height
 * is all that is needed to place the chest.
 *
 * Returns null when the profile does not have that shape (a head-and-shoulders
 * crop that never pinches, an object rather than a person, a failed cut-out that
 * left everything opaque). The caller then falls back to framing by aspect
 * ratio, which needs no understanding of the subject at all.
 */
function findSilhouette(
  alpha: Buffer,
  width: number,
  height: number,
): Silhouette | null {
  const widths = new Int32Array(height);
  let top = -1;
  let bottom = -1;
  let left = width;
  let right = -1;

  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] >= SOLID) {
        count += 1;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    widths[y] = count;
    if (count > 0) {
      if (top === -1) top = y;
      bottom = y;
    }
  }

  if (top === -1 || bottom - top < 40 || right < left) return null;

  // Smooth the profile before looking for turning points. The window is a
  // percentage of the subject's height rather than a fixed pixel count, because
  // the same photo at two resolutions has to reach the same answer — and it has
  // to be wide enough to flatten hair. Curly hair produces width swings of a few
  // pixels per row, and at a narrower window those read as a peak and a pinch,
  // which is exactly how an earlier version of this mistook a hairline for a
  // neck and cropped to the top of someone's head.
  const span = bottom - top + 1;
  const window = Math.max(2, Math.round(span * 0.025));
  const smooth = new Float64Array(span);
  for (let i = 0; i < span; i += 1) {
    let sum = 0;
    let n = 0;
    for (let k = -window; k <= window; k += 1) {
      const y = top + i + k;
      if (y >= top && y <= bottom) {
        sum += widths[y];
        n += 1;
      }
    }
    smooth[i] = sum / n;
  }

  let widest = 0;
  for (let i = 0; i < span; i += 1) if (smooth[i] > widest) widest = smooth[i];
  if (widest <= 0) return null;

  /*
   * Find the head's widest row: the FIRST place the profile stops growing.
   *
   * Deliberately not the global maximum — that is the shoulders or the torso in
   * any photo wider than a headshot. And the search runs over the top 60% rather
   * than the top third, because how much of the frame a head occupies depends
   * entirely on how the photo was taken: about an eighth of a full-length shot,
   * but nearly half of an already-cropped chest-up portrait. A third excluded
   * the second case, which is the single most likely thing to be uploaded here.
   */
  const searchTo = Math.floor(span * 0.6);
  let peak = -1;
  for (let i = 1; i < searchTo; i += 1) {
    if (smooth[i] >= smooth[i - 1]) continue;
    // A shoulder-height plateau is not a head; require a real bump.
    if (smooth[i - 1] < widest * 0.12) continue;
    peak = i - 1;
    break;
  }
  if (peak === -1) return null;

  // The neck is the narrowest row between the head and the shoulders.
  let neck = -1;
  let narrowest = Infinity;
  for (let i = peak + 1; i < Math.floor(span * 0.7); i += 1) {
    if (smooth[i] < narrowest) {
      narrowest = smooth[i];
      neck = i;
    }
  }
  if (neck === -1) return null;

  // Two checks that this is really a neck. It has to be a clear pinch below the
  // head's widest, and the body has to open out again below it — without the
  // second test, the bottom edge of any crop that stops at the jaw looks like a
  // neck, because the profile is still narrowing when the pixels run out.
  if (narrowest > smooth[peak] * 0.8) return null;
  let opensOut = false;
  for (let i = neck + 1; i < span; i += 1) {
    if (smooth[i] > narrowest * 1.2) {
      opensOut = true;
      break;
    }
  }
  if (!opensOut) return null;

  const headHeight = neck;
  // A head shorter than a tenth of the subject means the profile was misread.
  if (headHeight < 8 || headHeight < span * 0.1) return null;

  const chest = Math.min(bottom, top + Math.round(headHeight * CHEST_IN_HEADS));
  return { top, bottom, left, right, chest };
}

/**
 * Places a head-to-chest crop into the design's band.
 *
 * `cover` rather than `contain`: the design's own asset fills the band's width
 * and runs off its bottom edge, so matching that means overflowing deliberately
 * rather than letting the subject float with margins around them.
 */
async function compositeIntoBand(
  source: Sharp,
  region: { left: number; top: number; width: number; height: number },
): Promise<Buffer> {
  const subject = await source
    .extract(region)
    .resize({ width: CANVAS.w, height: BAND.h, fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: CANVAS.w,
      height: CANVAS.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left: 0, top: BAND.y }])
    .png()
    .toBuffer();
}

/**
 * Whether the upload is already a cut-out.
 *
 * An alpha channel that is opaque everywhere is decorative — plenty of PNGs
 * carry one without using it — so the test is whether any pixel is actually
 * transparent. If some are, the person has already done the cutting out, and
 * calling remove.bg would both cost them money and send a photo off this machine
 * for no gain. So this short-circuits the network call entirely.
 */
async function alreadyCutOut(input: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.hasAlpha) return false;
    const stats = await sharp(input).stats();
    const alpha = stats.channels[3];
    return Boolean(alpha) && alpha.min < 250;
  } catch {
    return false;
  }
}

/** Runs the whole pipeline. Never throws for a reason the caller can report. */
export async function treatPortrait(input: Buffer): Promise<TreatedPortrait> {
  const preCut = await alreadyCutOut(input);
  const cut = preCut ? { buffer: input } : await cutOutBackground(input);
  const removed = 'buffer' in cut;
  const working = removed ? cut.buffer : input;
  const note = removed ? undefined : cut.error;

  // Desaturate first so every later step sees the same pixels the card will.
  // `grayscale` keeps the alpha channel, which the framing below depends on.
  const grey = sharp(working).grayscale();
  const meta = await grey.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    return { buffer: input, backgroundRemoved: false, note: 'Could not read the image.' };
  }

  const greyBuffer = await grey.png().toBuffer();

  let region: { left: number; top: number; width: number; height: number } | null = null;

  if (removed) {
    const alpha = await sharp(greyBuffer).ensureAlpha().extractChannel(3).raw().toBuffer();
    const outline = findSilhouette(alpha, width, height);
    if (outline) {
      // A little air either side of the subject, so the shoulders are not
      // shaved by the band's edge.
      const padX = Math.round((outline.right - outline.left) * 0.06);
      const left = Math.max(0, outline.left - padX);
      const right = Math.min(width - 1, outline.right + padX);
      region = {
        left,
        top: outline.top,
        width: right - left + 1,
        height: outline.chest - outline.top + 1,
      };
    }
  }

  if (!region) {
    // No usable outline — frame by the band's own aspect from the top of the
    // photo, which is where a face is in practically every portrait. This is
    // also the path a failed cut-out takes.
    const aspect = CANVAS.w / BAND.h;
    const cropH = Math.min(height, Math.round(width / aspect));
    region = { left: 0, top: 0, width, height: cropH };
  }

  const buffer = await compositeIntoBand(sharp(greyBuffer), region);
  return { buffer, backgroundRemoved: removed, note };
}
