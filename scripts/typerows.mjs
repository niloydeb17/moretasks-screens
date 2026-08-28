// Dev utility: find the tiled-type text bands in the reference frame.
import sharp from 'sharp';

const { data, info } = await sharp(process.argv[2]).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const isType = (x, y) => {
  const i = (y * W + x) * 3;
  // tiled type #fedc8f, generous tolerance for antialiasing
  return Math.abs(data[i] - 254) <= 14 && Math.abs(data[i + 1] - 220) <= 16 && Math.abs(data[i + 2] - 143) <= 22;
};

// Sample only columns outside the card (card spans x 112..967) to avoid its white mass.
const cols = [];
for (let x = 0; x < 112; x++) cols.push(x);
for (let x = 968; x < W; x++) cols.push(x);

const rows = [];
for (let y = 0; y < H; y++) {
  let n = 0;
  for (const x of cols) if (isType(x, y)) n++;
  rows.push(n / cols.length);
}

const runs = [];
let start = -1;
for (let y = 0; y < H; y++) {
  const on = rows[y] > 0.30;
  if (on && start < 0) start = y;
  if (!on && start >= 0) { runs.push([start, y - 1, y - start]); start = -1; }
}
if (start >= 0) runs.push([start, H - 1, H - start]);
console.log('type bands [startY, endY, height] (outside-card columns, >30% coverage):');
for (const r of runs) console.log(' ', r);

// glyph height + baseline pitch
if (runs.length > 1) {
  const pitches = runs.slice(1).map((r, i) => r[0] - runs[i][0]);
  console.log('band pitch (start-to-start):', pitches);
}
