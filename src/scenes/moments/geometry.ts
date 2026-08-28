/**
 * "MoreTasks Highlights" (Moments) geometry — Figma node 457:211128 in file
 * BPG2IS230Tr5g6YITfEdXg ("Placeholders").
 *
 * The design is a camera flying across a wall of portrait shorts, stopping to
 * zoom into one at a time. Figma draws that wall as a fixed 15 x 9 grid of 132
 * tiles filled with placeholder imagery, but only a handful are ever visited —
 * so the wall here is COMPUTED: one *stop* per short, on a wall sized to keep
 * the camera surrounded by tiles at every point of the flight.
 *
 * The tile box and the gap below are Figma's own values, confirmed by closing
 * the mock's full 15 x 9 wall against the size Figma reports for it:
 *
 *   width   3 x (5 x 1163.024 + 4 x 76.264) + 2 x 84.738 = 18530.004  (Figma 18530)
 *   height  3 x (3 x 2067.598 + 2 x 76.264) + 2 x 76.264 = 19218.494  (Figma 19218.492)
 *
 * The 84.738 in that first line is a wider gap Figma uses between the three
 * column groups the mock was hand-assembled from. A generated wall has no such
 * groups, so it uses the single 76.264 gap throughout.
 */

export const CANVAS = { w: 1080, h: 1920 } as const;

/**
 * One short's tile. Exactly 9:16 — the same ratio as the canvas, which is
 * precisely why a single tile can fill the frame edge to edge when the camera
 * zooms all the way in. Keep these two in step if either ever changes.
 */
export const TILE = { w: 1163.024, h: 2067.598 } as const;

/** Figma's gap between tiles. */
export const GAP = 76.264;

/** The wall's own backdrop, visible in the gaps. Figma reports the frame fill as white. */
export const WALL_BG = '#ffffff';

/**
 * The highlights card's palette, sampled from Figma's render of the card
 * (`get_screenshot` on the frame at rest, which is parked on this tile).
 */
export const CARD = {
  bg: '#fcf6ee',
  ink: '#060605',
  swoosh: '#f9ab00',
  heart: '#f56882',
  arrow: '#7c5cf0',
} as const;

/** Placeholder tile fills, for a short with no thumbnail supplied yet. */
export const PLACEHOLDER = {
  bg: '#ece7df',
  ink: '#9a9287',
} as const;

/**
 * How many screens one video can carry — shorts and achievements together,
 * since each takes one stop on the flight path.
 *
 * Not a limit Figma states. The binding constraint is that the wall's area
 * grows with the SQUARE of the stop count — the flight path is a ring, and a
 * ring of n stops needs a wall roughly n/2 tiles on a side — so this keeps the
 * tile count (and therefore the cost of rasterising every exported frame)
 * inside the same order as Figma's own 132-tile mock.
 */
export const MAX_SCREENS = 12;

/**
 * Filler tiles kept around the flight path on every side.
 *
 * At the pulled-back scale the camera sees about 1.6 tiles across, so it can
 * reach at most 0.8 of a tile beyond whichever stop it is sitting on. One tile
 * of padding therefore guarantees the frame is full of wall at every point of
 * the flight — no edge, no background showing through at the top or bottom.
 */
const MARGIN = 1;

/**
 * What a tile shows.
 *
 * `blank` is only reached next to a stop when the short list is too short to
 * offer any alternative — with one short in the payload, every tile that isn't
 * the stop would otherwise be a copy of it. Leaving those neighbours empty is
 * what keeps the "a stop is unique in its own neighbourhood" rule absolute
 * rather than best-effort.
 */
export type TileContent =
  | { kind: 'card' }
  | { kind: 'short'; index: number }
  | { kind: 'achievement'; index: number }
  | { kind: 'quote'; index: number }
  | { kind: 'blank' };

export interface Tile {
  x: number;
  y: number;
  content: TileContent;
}

export interface Wall {
  cols: number;
  rows: number;
  w: number;
  h: number;
  tiles: Tile[];
  /**
   * Tile indices the camera stops and zooms on, in flight order. `stops[0]` is
   * the highlights card; then one per short, then one per achievement, both in
   * panel order. The camera returns to `stops[0]` after the last, which is what
   * closes the loop.
   */
  stops: number[];
}

/**
 * Deterministic pseudo-random in [0, 1) from an integer seed.
 *
 * The wall has to be pixel-identical in the browser preview and in the headless
 * capture — that is the whole contract this repo's render pipeline rests on — so
 * `Math.random` cannot be used to place the filler. Same tile index, same
 * choice, every render, forever.
 */
function seeded(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The flight path, as grid cells.
 *
 * Every hop has to be a diagonal — corner to corner, never straight along an
 * edge — and the path has to close, returning to where it began. Both fall out
 * of one change of coordinates: writing a cell as `col = u + v, row = u - v`
 * turns a diagonal step in the grid into a single step along `u` or `v`. So a
 * closed diagonal circuit is nothing more than the perimeter of a rectangle
 * walked in (u, v), which is trivially closed and never doubles back.
 *
 * A rectangle W x H has 2(W + H) perimeter cells, always even. An odd number of
 * stops therefore needs one cell of that ring skipped — and it has to be a cell
 * in the middle of a straight run, never a corner: skipping a corner joins two
 * steps that cancel on one axis, which lands the camera in a purely sideways
 * move, the one thing the path must not do.
 */
function flightPath(stopCount: number): { col: number; row: number }[] {
  // Short paths get a straight diagonal line instead of a ring. A ring needs at
  // least six cells before it has any non-corner to skip, so below that the
  // line is both simpler and the only shape that stays diagonal on every hop —
  // including the long hop home, which runs back down the same diagonal.
  if (stopCount <= 4) {
    return Array.from({ length: stopCount }, (_, i) => ({ col: i, row: i }));
  }

  const ring = stopCount % 2 === 0 ? stopCount : stopCount + 1;
  const half = ring / 2;
  const w = Math.max(2, Math.round(half / 2));
  const h = Math.max(1, half - w);

  // The perimeter, walked as unit steps in (u, v). Corners land at walk indices
  // 0, w, w + h and 2w + h; everything else is mid-run and safe to skip.
  const walk: { u: number; v: number }[] = [];
  for (let u = 0; u < w; u += 1) walk.push({ u, v: 0 });
  for (let v = 0; v < h; v += 1) walk.push({ u: w, v });
  for (let u = w; u > 0; u -= 1) walk.push({ u, v: h });
  for (let v = h; v > 0; v -= 1) walk.push({ u: 0, v });

  const corners = new Set([0, w, w + h, 2 * w + h]);
  let toSkip = walk.length - stopCount;
  const kept = walk.filter((_, i) => {
    if (toSkip > 0 && !corners.has(i)) {
      toSkip -= 1;
      return false;
    }
    return true;
  });

  return kept.map(({ u, v }) => ({ col: u + v, row: u - v }));
}

/**
 * Lays out the wall: one stop per screen plus the highlights card, a ring of
 * filler around them, and a short assigned to every filler tile.
 *
 * Filler is drawn from the shorts only — never from the achievements or the
 * quotes. Those are composed designs, not wall texture: repeating one would read
 * as a mistake, and it would also mean rasterising a whole extra scene per
 * filler tile. Each appears exactly once, at its own stop.
 */
export function buildWall(shortCount: number, achievementCount = 0, quoteCount = 0): Wall {
  const wanted = Math.max(0, Math.round(shortCount) || 0);
  // The authored screens have first claim on the ring; shorts give way, since
  // they are the ones the filler is made of anyway.
  const authored = Math.min(
    Math.max(0, Math.round(achievementCount) || 0) + Math.max(0, Math.round(quoteCount) || 0),
    MAX_SCREENS,
  );
  const achievements = Math.min(Math.max(0, Math.round(achievementCount) || 0), authored);
  const quotes = Math.min(Math.max(0, Math.round(quoteCount) || 0), authored - achievements);
  const shorts = Math.max(
    authored > 0 ? 0 : 1,
    Math.min(wanted, MAX_SCREENS - authored),
  );

  const path = flightPath(shorts + achievements + quotes + 1);
  const cols0 = Math.min(...path.map((p) => p.col));
  const rows0 = Math.min(...path.map((p) => p.row));
  const cols = Math.max(...path.map((p) => p.col)) - cols0 + 1 + MARGIN * 2;
  const rows = Math.max(...path.map((p) => p.row)) - rows0 + 1 + MARGIN * 2;

  // Path cells -> tile indices on the padded grid.
  const stops = path.map(
    (p) => (p.row - rows0 + MARGIN) * cols + (p.col - cols0 + MARGIN),
  );

  // Stop 0 is the card, then the shorts, then the achievements, then the quotes
  // — each group in panel order, so the numbering in the form is the order the
  // camera lands on them.
  const atStop = new Map<number, TileContent>();
  stops.forEach((tileIndex, stop) => {
    if (stop === 0) atStop.set(tileIndex, { kind: 'card' });
    else if (stop <= shorts) atStop.set(tileIndex, { kind: 'short', index: stop - 1 });
    else if (stop <= shorts + achievements)
      atStop.set(tileIndex, { kind: 'achievement', index: stop - shorts - 1 });
    else atStop.set(tileIndex, { kind: 'quote', index: stop - shorts - achievements - 1 });
  });

  // `null` means "not decided yet" while the filler pass runs; the return below
  // is what narrows this back to `Tile`.
  const tiles: { x: number; y: number; content: TileContent | null }[] = Array.from(
    { length: cols * rows },
    (_, i) => ({
      x: (i % cols) * (TILE.w + GAP),
      y: Math.floor(i / cols) * (TILE.h + GAP),
      content: atStop.get(i) ?? null,
    }),
  );
  const isStop = new Set(stops);
  const everyShort = Array.from({ length: shorts }, (_, s) => s);

  // Filler. Every stop is placed already, so a tile touching one can see what it
  // holds and refuse it.
  //
  // The two exclusions are NOT equal in weight. A short sitting next to its own
  // stop is disqualifying: pulling back off a stop would show the same thumbnail
  // twice at once, which is exactly what makes the zoom read as arbitrary. A
  // short repeated next to another *filler* tile is only untidy, so it is
  // avoided where there is room and conceded where the list is too short.
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i].content !== null) continue;

    const col = i % cols;
    const row = Math.floor(i / cols);
    const besideStop = new Set<number>();
    const besideFiller = new Set<number>();
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const c = col + dc;
        const r = row + dr;
        if ((dc === 0 && dr === 0) || c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const at = r * cols + c;
        const neighbour = tiles[at].content;
        if (neighbour?.kind !== 'short') continue;
        (isStop.has(at) ? besideStop : besideFiller).add(neighbour.index);
      }
    }

    const allowed = everyShort.filter((s) => !besideStop.has(s));
    const preferred = allowed.filter((s) => !besideFiller.has(s));
    const pool = preferred.length > 0 ? preferred : allowed;
    tiles[i].content =
      pool.length > 0
        ? { kind: 'short', index: pool[Math.floor(seeded(i) * pool.length) % pool.length] }
        : { kind: 'blank' };
  }

  return {
    cols,
    rows,
    w: cols * TILE.w + (cols - 1) * GAP,
    h: rows * TILE.h + (rows - 1) * GAP,
    // Every tile has been decided by the loop above, so the nullable staging
    // type is spent here rather than leaking into the scene.
    tiles: tiles as Tile[],
    stops,
  };
}

/** Centre of a tile, in wall coordinates — what the camera aims at. */
export function tileCentre(wall: Wall, index: number): { x: number; y: number } {
  const tile = wall.tiles[index] ?? wall.tiles[0];
  return { x: tile.x + TILE.w / 2, y: tile.y + TILE.h / 2 };
}
