// Dev utility: diff a sub-rectangle, to attribute error to one element.
import sharp from 'sharp';
const [a, b, x, y, w, h] = process.argv.slice(2);
const crop = { left: +x, top: +y, width: +w, height: +h };
const [ra, rb] = await Promise.all([a, b].map((f) =>
  sharp(f).extract(crop).removeAlpha().raw().toBuffer()
));
let diff = 0;
const total = +w * +h;
for (let p = 0; p < total; p++) {
  const i = p * 3;
  const d = Math.max(Math.abs(ra[i]-rb[i]), Math.abs(ra[i+1]-rb[i+1]), Math.abs(ra[i+2]-rb[i+2]));
  if (d > 8) diff++;
}
console.log(`  region ${w}x${h} @ (${x},${y}): ${(diff/total*100).toFixed(2)}% differing`);
