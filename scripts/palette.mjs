// Dev utility: report the dominant colours of an image, for matching Figma renders.
import sharp from 'sharp';

const file = process.argv[2];
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const counts = new Map();
for (let i = 0; i < data.length; i += 3) {
  const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  counts.set(hex, (counts.get(hex) ?? 0) + 1);
}

const total = info.width * info.height;
console.log(`${info.width}x${info.height}, ${counts.size} distinct colours`);
for (const [hex, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${hex}  ${((n / total) * 100).toFixed(2)}%`);
}
