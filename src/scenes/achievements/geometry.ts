/**
 * "Personal Achivements & Desk Diaries" geometry — Figma node 1:10192.
 *
 * Every number here was read straight off the Figma document through the
 * Desktop Bridge plugin (`node.relativeTransform`, `node.width/height`, auto-layout
 * padding, and `Paint.imageTransform`). Nothing was measured off a screenshot and
 * nothing was rounded, so this file is the design, verbatim.
 *
 * Two Figma concepts are carried through rather than flattened, because
 * flattening either one loses precision:
 *
 *   `transform`     Figma's `relativeTransform`, a 2x3 affine matrix. Emitting it
 *                   as a CSS `matrix()` reproduces rotation AND mirroring exactly
 *                   (the push pin is mirrored, so a plain `rotate()` cannot express
 *                   it), with no trig of our own to round.
 *
 *   `imageTransform` Figma's normalised crop rectangle for a `scaleMode: "CROP"`
 *                   fill. `cropStyle()` converts it to CSS offsets; see there.
 *
 * Do not "tidy" these into round numbers; they are the design.
 */

// Figma geometry helpers live in one place so every scene decodes matrices and
// image crops identically; re-exported here because this file is the geometry
// entry point the achievements scene imports from.
export {
  COVER,
  cropStyle,
  figmaMatrix,
  nodeStyle,
  type Transform,
} from '@/lib/figmaTransform';
import type { Transform } from '@/lib/figmaTransform';

export const CANVAS = { w: 1080, h: 1920 } as const;

const ASSETS = '/assets/achievements';

/**
 * The backdrop: a wide cloud plate that drifts sideways behind everything, with
 * a flat haze over it.
 *
 * The plate is a single 9557 x 1920 image — 8.8x the canvas width — so the 2829.5px
 * drift has somewhere to go. It is the revised frame's own asset (node 3:148). An
 * earlier build used a 5116-wide plate carried over from the superseded design;
 * its cloud content is simply different, which is why the sky read wrong.
 *
 * The plate is fully opaque, so it covers `sky` outright; that stays only as what
 * shows in the instant before the plate decodes.
 *
 * THE BLUR IS BAKED INTO THE ASSET, not applied in CSS. The design expresses it
 * as `backdrop-filter: blur(20px)` on a layer above the plate, which cannot be
 * used here for two independent reasons:
 *
 *  - `backdrop-filter` needs a live compositor and a real backdrop behind it. The
 *    MP4 exporter rasterises each frame by serialising the DOM to XML and
 *    decoding it (see `lib/browserExport`), where it silently does nothing — the
 *    preview would look right and the downloaded video would come out unblurred.
 *  - even as a plain `filter`, it would re-blur a 9557px-wide element on every
 *    one of the 720 frames an export walks.
 *
 * Baking it costs nothing visually: the blur's only input is this plate, so a
 * pre-blurred plate is the same pixels. Re-bake with `sharp(src).blur(20)` if the
 * radius ever changes.
 *
 * One caveat on the asset itself: Figma's MCP export caps this image at 1024x205
 * however it is requested, so the committed plate is that preview upscaled to the
 * design's own size and then blurred. The blur is what makes that acceptable —
 * 20px at 9557 wide is ~2px at 1024 wide, so it removes most of what the
 * downscale lost. Replace it with a manual 1x export from Figma for a sharper
 * plate; nothing in the code needs to change.
 */
export const BACKGROUND = {
  sky: `${ASSETS}/sky.webp`,
  clouds: {
    src: `${ASSETS}/clouds-wide.webp`,
    w: 9557,
    h: 1920,
  },
  /** The design's overlay fill, sampled from it directly. */
  haze: 'rgba(168, 168, 168, 0.32)',
} as const satisfies {
  sky: string;
  clouds: { src: string; w: number; h: number };
  haze: string;
};

/** Backdrop behind two of the photos, showing through while the image loads. */
export const PHOTO_BACKDROP = '#dadada';

export interface PhotoCard {
  /** Figma node id, for tracing a value back to the document. */
  id: string;
  /** Placement of the `Frames` instance on the canvas. */
  transform: Transform;
  w: number;
  h: number;
  /** The photo well, inset by the card's auto-layout padding. */
  photo: { x: number; y: number; w: number; h: number };
  src: string;
  /** Present only where Figma has a solid paint under the image. */
  backdrop?: string;
  /** Present only for `scaleMode: "CROP"` fills; otherwise the fill covers. */
  crop?: Transform;
}

/**
 * The five polaroids, in Figma z-order (back to front).
 *
 * Each is an instance of the same `Frames` component: a white auto-layout frame
 * whose padding is uneven — a wide bottom lip, like a real polaroid. The `photo`
 * box below is Figma's own measurement of the resulting child, not `w - 2·padding`,
 * so the two cannot drift apart through float error.
 */
export const PHOTO_CARDS: readonly PhotoCard[] = [
  {
    id: '1:10193',
    transform: [
      [0.9461418986320496, 0.3237522840499878, 482.26171875],
      [-0.3237522840499878, 0.9461418986320496, 251.28619384765625],
    ],
    w: 439.4912109375,
    h: 471.173583984375,
    photo: { x: 19.496822357177734, y: 19.496822357177734, w: 400.49755859375, h: 399.6852111816406 },
    src: `${ASSETS}/photo-1.webp`,
    backdrop: PHOTO_BACKDROP,
  },
  {
    id: '1:10194',
    transform: [
      [0.9342044591903687, -0.35673800110816956, 636.9403076171875],
      [0.35673800110816956, 0.9342044591903687, 1159.9091796875],
    ],
    w: 421.50885009765625,
    h: 451.89483642578125,
    photo: { x: 18.699113845825195, y: 18.69908332824707, w: 384.1106262207031, h: 383.3315124511719 },
    src: `${ASSETS}/photo-5.webp`,
  },
  {
    id: '1:10195',
    transform: [
      [0.9849890470504761, -0.17261679470539093, 194.332763671875],
      [0.17261679470539093, 0.9849890470504761, 369.587890625],
    ],
    w: 439.4912109375,
    h: 471.173583984375,
    photo: { x: 19.496763229370117, y: 19.49688148498535, w: 400.49755859375, h: 399.6852111816406 },
    src: `${ASSETS}/photo-2.webp`,
  },
  {
    id: '1:10196',
    transform: [
      [0.9962401986122131, 0.08663412183523178, 341.8876953125],
      [-0.08663412183523178, 0.9962401986122131, 765.6160888671875],
    ],
    w: 473.89605712890625,
    h: 508.0586242675781,
    photo: { x: 21.023101806640625, y: 21.023117065429688, w: 431.849853515625, h: 430.973876953125 },
    src: `${ASSETS}/photo-3.webp`,
    backdrop: PHOTO_BACKDROP,
    crop: [
      [1, 0, -0.012708219699561596],
      [0, 0.6189950108528137, 0.0999293401837349],
    ],
  },
  {
    id: '1:10197',
    transform: [
      [0.9857915639877319, 0.16797325015068054, 113.44287109375],
      [-0.16797325015068054, 0.9857915639877319, 1290.0220947265625],
    ],
    w: 450.0941162109375,
    h: 482.540771484375,
    photo: { x: 19.96721839904785, y: 19.967187881469727, w: 410.15960693359375, h: 409.3276672363281 },
    src: `${ASSETS}/photo-4.webp`,
  },
];

export interface Sticker {
  id: string;
  transform: Transform;
  w: number;
  h: number;
  src: string;
  crop?: Transform;
}

/**
 * The desk oddments pinning the collage together — clip, pin, tape, cookie.
 *
 * The push pin's matrix has a negative determinant: it is mirrored as well as
 * rotated. That is why these are placed by matrix and not by `rotate()`.
 */
export const STICKERS = {
  binderClip: {
    id: '1:10198',
    transform: [
      [0.9478375911712646, 0.318753719329834, 577],
      [-0.318753719329834, 0.9478375911712646, 91.52294158935547],
    ],
    w: 174.18759155273438,
    h: 174.18759155273438,
    src: `${ASSETS}/binder-clip.webp`,
  },
  paperClip: {
    id: '1:10200',
    transform: [
      [0.9920110702514648, 0.12615090608596802, 962.6184692382812],
      [-0.12615090608596802, 0.9920110702514648, 1264.1177978515625],
    ],
    w: 57.6160774230957,
    h: 122.71117401123047,
    src: `${ASSETS}/paper-clip.webp`,
    crop: [
      [0.4038834869861603, 0, 0.223300963640213],
      [0, 0.711075484752655, 0.10754415392875671],
    ],
  },
  washiTape: {
    id: '1:10201',
    transform: [
      [0.7751469612121582, 0.6317808628082275, 45],
      [-0.6317808628082275, 0.7751469612121582, 1343.5296630859375],
    ],
    w: 189.1948699951172,
    h: 98.10104370117188,
    src: `${ASSETS}/washi-tape.webp`,
    crop: [
      [0.8640000224113464, 0, 0.07000000029802322],
      [0, 0.44800010323524475, 0.2980000376701355],
    ],
  },
  heartCookie: {
    id: '1:10202',
    transform: [
      [0.8451651930809021, -0.5345051288604736, 788.8684692382812],
      [0.5345051288604736, 0.8451651930809021, 586],
    ],
    w: 286,
    h: 286,
    src: `${ASSETS}/heart-cookie.webp`,
  },
  pushPin: {
    id: '1:10204',
    transform: [
      [-0.9527971148490906, 0.30360767245292664, 235.677490234375],
      [0.30360767245292664, 0.9527971148490906, 292],
    ],
    w: 149.7459259033203,
    h: 140.3867950439453,
    src: `${ASSETS}/push-pin.webp`,
  },
} as const satisfies Record<string, Sticker>;

/**
 * Text blocks.
 *
 * Figma reports `lineHeight: AUTO` for the two serif blocks, meaning "the font's
 * own line height". Rather than trust the browser to derive the same number, the
 * ratio Figma actually laid out with is pinned here: the title box is 102px tall
 * for one 76px line and the closer is 134px for two 50.16px lines, which agree on
 * 1.33559. `letterSpacing` is Figma's -2%, resolved against each font size.
 */
const AUTO_LINE_HEIGHT_RATIO = 1.33559;

export const TEXT = {
  /** Display title, top left. */
  title: {
    id: '1:10199',
    x: 76,
    y: 56,
    fontSize: 76,
    lineHeight: 76 * AUTO_LINE_HEIGHT_RATIO,
    letterSpacing: 76 * -0.02,
    color: '#ffffff',
  },
  /** Names line under the title. White at 80% — a fill opacity in Figma. */
  names: {
    id: '1:10205',
    x: 76,
    y: 158,
    w: 362,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  /**
   * Closing line, bottom right.
   *
   * Retaken from the revised frame (node 3:160), which nudges it down and right
   * and widens the box — the earlier values came from the superseded layout.
   */
  closer: {
    id: '3:160',
    x: 690,
    y: 1760,
    w: 362,
    fontSize: 50,
    lineHeight: 50 * AUTO_LINE_HEIGHT_RATIO,
    letterSpacing: -1,
    color: '#ffffff',
  },
} as const;
