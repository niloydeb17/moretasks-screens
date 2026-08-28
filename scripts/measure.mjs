// Dev utility: locate the polaroid card + hat in the Figma reference frame,
// so the code reconstruction can use real geometry instead of eyeballed values.
import sharp from 'sharp';

const file = process.argv[2];
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

const at = (x, y) => {
  const i = (y * W + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const near = ([r, g, b], [tr, tg, tb], tol = 8) =>
  Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol;

function bbox(pred) {
  let minX = W, minY = H, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!pred(at(x, y))) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, count, w: maxX - minX + 1, h: maxY - minY + 1 };
}

console.log(`frame ${W}x${H}`);
console.log('white polaroid :', bbox((p) => near(p, [255, 255, 255])));
console.log('hat cream      :', bbox((p) => near(p, [255, 238, 202])));

// Row profile of white pixels reveals the card top/bottom and the caption band.
const rows = [];
for (let y = 0; y < H; y++) {
  let n = 0;
  for (let x = 0; x < W; x++) if (near(at(x, y), [255, 255, 255])) n++;
  rows.push(n);
}
const runs = [];
let start = -1;
for (let y = 0; y < H; y++) {
  const solid = rows[y] > W * 0.25;
  if (solid && start < 0) start = y;
  if (!solid && start >= 0) { runs.push([start, y - 1]); start = -1; }
}
if (start >= 0) runs.push([start, H - 1]);
console.log('wide-white row bands (>25% of width):', runs);
