// Dev utility: reference | candidate | heatmap, side by side for inspection.
import sharp from 'sharp';
const [a, b, c, out] = process.argv.slice(2);
const H = 620, W = Math.round(H * 1080 / 1920);
const imgs = await Promise.all([a, b, c].filter(Boolean).map((f) =>
  sharp(f).resize(W, H).removeAlpha().png().toBuffer()
));
await sharp({ create: { width: W * imgs.length + 20 * (imgs.length - 1), height: H, channels: 3, background: '#222' } })
  .composite(imgs.map((input, i) => ({ input, left: i * (W + 20), top: 0 })))
  .png().toFile(out);
console.log('wrote', out);
