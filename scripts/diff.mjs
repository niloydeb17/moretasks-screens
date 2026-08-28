/**
 * Compares two PNGs and reports how far apart they are.
 *
 * This is how "faithful to the design" becomes a number instead of an opinion:
 * capture a frame from the code scene, diff it against the Figma reference, and
 * read the percentage of pixels that actually differ.
 *
 * Usage:
 *   node scripts/diff.mjs reference/birthday-1080x1920.png out/birthday-f0.png
 *   node scripts/diff.mjs a.png b.png --heatmap out/diff.png --tolerance 8
 *   node scripts/diff.mjs a.png b.png --exclude 132,431,816,990
 *
 * `--exclude x,y,w,h` skips a rectangle. Use it for regions holding dynamic
 * content (an uploaded photo), which can never match a reference and would
 * otherwise swamp the score for the static design around it.
 */

import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const positional = [];
const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    flags[argv[i].slice(2)] = argv[i + 1];
    i++;
  } else {
    positional.push(argv[i]);
  }
}

const [fileA, fileB] = positional;
if (!fileA || !fileB) {
  console.error('Usage: node scripts/diff.mjs <reference.png> <candidate.png> [--heatmap out.png] [--tolerance 8]');
  process.exit(1);
}

const tolerance = Number(flags.tolerance ?? 8);
const heatmapPath = flags.heatmap ? path.resolve(flags.heatmap) : null;

async function load(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const a = await load(fileA);
const b = await load(fileB);

if (a.width !== b.width || a.height !== b.height) {
  console.error(
    `Size mismatch: ${path.basename(fileA)} is ${a.width}x${a.height}, ` +
      `${path.basename(fileB)} is ${b.width}x${b.height}. Cannot compare.`,
  );
  process.exit(1);
}

const pixels = a.width * a.height;
const exclude = flags.exclude
  ? (() => {
      const [x, y, w, h] = flags.exclude.split(',').map(Number);
      return { x, y, w, h };
    })()
  : null;
const inExcluded = (px, py) =>
  exclude !== null &&
  px >= exclude.x &&
  px < exclude.x + exclude.w &&
  py >= exclude.y &&
  py < exclude.y + exclude.h;

let compared = 0;
let differing = 0;
let sumAbs = 0;
let maxDelta = 0;
const heat = heatmapPath ? Buffer.alloc(pixels * 3) : null;

for (let p = 0; p < pixels; p++) {
  const i = p * 3;
  const px = p % a.width;
  const py = (p - px) / a.width;

  if (inExcluded(px, py)) {
    if (heat) {
      // Excluded regions render blue, so the heatmap cannot be misread as a pass.
      heat[i] = 0;
      heat[i + 1] = 40;
      heat[i + 2] = 120;
    }
    continue;
  }

  const dr = Math.abs(a.data[i] - b.data[i]);
  const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
  const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
  const delta = Math.max(dr, dg, db);

  compared++;
  sumAbs += (dr + dg + db) / 3;
  if (delta > maxDelta) maxDelta = delta;
  if (delta > tolerance) differing++;

  if (heat) {
    // Differences in red over a dimmed copy of the reference, so it is obvious
    // *where* the reconstruction is wrong, not just how much.
    const over = delta > tolerance;
    heat[i] = over ? 255 : a.data[i] >> 2;
    heat[i + 1] = over ? 0 : a.data[i + 1] >> 2;
    heat[i + 2] = over ? 0 : a.data[i + 2] >> 2;
  }
}

const total = compared;
const pctDiffering = (differing / total) * 100;
console.log(`reference : ${fileA}`);
console.log(`candidate : ${fileB}`);
console.log(`size      : ${a.width}x${a.height} (${pixels.toLocaleString()} px)`);
if (exclude) {
  console.log(
    `excluded  : ${exclude.w}x${exclude.h} @ (${exclude.x},${exclude.y}) — dynamic content`,
  );
  console.log(`compared  : ${total.toLocaleString()} px`);
}
console.log(`tolerance : +/-${tolerance} per channel`);
console.log(`differing : ${differing.toLocaleString()} px (${pctDiffering.toFixed(2)}%)`);
console.log(`mean err  : ${(sumAbs / total).toFixed(2)} / 255`);
console.log(`max delta : ${maxDelta} / 255`);

if (heat) {
  await sharp(heat, { raw: { width: a.width, height: a.height, channels: 3 } })
    .png()
    .toFile(heatmapPath);
  console.log(`heatmap   : ${heatmapPath}`);
}
