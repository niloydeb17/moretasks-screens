/**
 * Captures a single frame of a scene as a PNG.
 *
 * This is the fidelity-check tool: capture frame N from the code scene, then
 * `scripts/diff.mjs` it against the Figma reference in `reference/`.
 *
 * Usage:
 *   node scripts/still.mjs --scene birthday --frame 0 --out out/birthday-f0.png
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--')) continue;
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const scene = args.scene ?? 'birthday';
const frame = Number(args.frame ?? 0);
const baseUrl = (args['base-url'] ?? 'http://localhost:3000').replace(/\/$/, '');
const outPath = path.resolve(args.out ?? `out/${scene}-f${frame}.png`);
const sceneData = args.data ? JSON.parse(args.data) : null;

async function main() {
  const res = await fetch(`${baseUrl}/api/compositions`);
  if (!res.ok) throw new Error(`Cannot reach ${baseUrl} (HTTP ${res.status}). Is the app running?`);
  const { compositions } = await res.json();
  const composition = compositions.find((c) => c.id === scene);
  if (!composition) throw new Error(`Unknown scene "${scene}"`);

  await mkdir(path.dirname(outPath), { recursive: true });

  const url = new URL(`${baseUrl}/render/${scene}`);
  url.searchParams.set('frame', String(frame));
  if (sceneData) url.searchParams.set('d', JSON.stringify(sceneData));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--font-render-hinting=none'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: composition.width,
      height: composition.height,
      deviceScaleFactor: 1,
    });
    await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.waitForSelector('html[data-render-ready="1"]', { timeout: 60_000 });
    await page.evaluate((n) => window.__seekToFrame(n), frame);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Wrote ${outPath} (${composition.width}x${composition.height}, frame ${frame})`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`Still capture failed: ${err.message}`);
  process.exit(1);
});
