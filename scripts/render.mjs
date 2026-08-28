/**
 * Headless renderer: scene + data -> MP4.
 *
 * The frame range is split into contiguous chunks, one per worker. Each worker
 * drives its own browser, seeks its own slice of frames, and encodes them into
 * a segment; the segments are then concatenated without re-encoding. Rendering
 * a frame is CPU-bound in two places — the page paint and the image encode —
 * so on a multi-core machine the wall clock is dominated by however many
 * workers run at once, not by the frame count.
 *
 * Two rules keep the output exact regardless of how it is split:
 *   - every frame is reached by seeking, never by playback, so a frame's
 *     content depends only on its index
 *   - a screenshot is only taken after a real paint has been awaited
 *
 * Usage:
 *   node scripts/render.mjs --scene birthday --out out/birthday.mp4 \
 *     --data '{"name":"Niloy Deb","subtitle":"22 Aug","photoUrl":"/assets/birthday/sample-photo.png"}'
 *
 * Requires the app to be running (`npm run dev` or `npm start`).
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import ffmpegPath from 'ffmpeg-static';
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
const baseUrl = (args['base-url'] ?? 'http://localhost:3000').replace(/\/$/, '');
const outPath = path.resolve(args.out ?? `out/${scene}.mp4`);
const crf = args.crf ?? '18';
const sceneData = args.data ? JSON.parse(args.data) : null;

/**
 * JPEG for the browser->ffmpeg handoff by default: encoding a 1080x1920 PNG
 * costs roughly twice what the equivalent JPEG does, and the frames are being
 * re-encoded into h264 immediately afterwards, so the intermediate's own
 * lossless-ness buys nothing. `--format png` restores it for exact work.
 */
const format = args.format ?? 'jpeg';
const quality = Number(args.quality ?? 95);
/** x264 preset. `veryfast` at CRF 18 encodes far quicker at negligible cost here. */
const preset = args.preset ?? 'veryfast';

const LAUNCH_ARGS = ['--force-device-scale-factor=1', '--hide-scrollbars', '--font-render-hinting=none'];

async function fetchComposition() {
  const res = await fetch(`${baseUrl}/api/compositions`);
  if (!res.ok) {
    throw new Error(
      `Could not read compositions from ${baseUrl} (HTTP ${res.status}). Is the app running?`,
    );
  }
  const { compositions } = await res.json();
  const found = compositions.find((c) => c.id === scene);
  if (!found) {
    const known = compositions.map((c) => c.id).join(', ');
    throw new Error(`Unknown scene "${scene}". Available: ${known}`);
  }
  return found;
}

/** Writes to a stream, respecting backpressure so large frames cannot be dropped. */
function write(stream, buffer) {
  if (stream.write(buffer)) return Promise.resolve();
  return new Promise((resolve) => stream.once('drain', resolve));
}

function spawnEncoder(fps, target) {
  const ffmpeg = spawn(ffmpegPath, [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(fps),
    '-i', '-',
    '-c:v', 'libx264',
    '-preset', preset,
    '-pix_fmt', 'yuv420p',
    '-crf', String(crf),
    '-movflags', '+faststart',
    target,
  ]);

  let stderr = '';
  ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
  const done = new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`)),
    );
  });
  return { ffmpeg, done };
}

/** Renders [startFrame, endFrame) into `target`, reporting each frame finished. */
async function renderChunk({ startFrame, endFrame, target, composition, url, onFrame }) {
  const { width, height, fps } = composition;
  const browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
  const { ffmpeg, done } = spawnEncoder(fps, target);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120_000 });
    await page.waitForSelector('html[data-render-ready="1"]', { timeout: 120_000 });

    const shot = format === 'png'
      ? { type: 'png', optimizeForSpeed: true }
      : { type: 'jpeg', quality, optimizeForSpeed: true };

    for (let frame = startFrame; frame < endFrame; frame++) {
      await page.evaluate((n) => window.__seekToFrame(n), frame);
      await write(ffmpeg.stdin, await page.screenshot(shot));
      onFrame();
    }
  } finally {
    ffmpeg.stdin.end();
    await browser.close();
  }

  await done;
}

/** Joins the per-worker segments without re-encoding — a stream copy. */
async function concatSegments(segments, listPath) {
  await writeFile(listPath, segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
  const ffmpeg = spawn(ffmpegPath, [
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-c', 'copy', '-movflags', '+faststart', outPath,
  ]);
  let stderr = '';
  ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
  await new Promise((resolve, reject) => {
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg concat exited ${code}\n${stderr.slice(-2000)}`)),
    );
  });
}

async function main() {
  const composition = await fetchComposition();
  const { width, height, fps } = composition;

  // `--frames` lets the caller override the composition's static length for
  // payload-dependent scenes (birthday plays one card per person, so its length
  // is a function of the data). The app computes it via `resolveDurationInFrames`;
  // without the flag the composition's own number stands.
  const durationInFrames = args.frames ? Number(args.frames) : composition.durationInFrames;
  if (!Number.isFinite(durationInFrames) || durationInFrames < 1) {
    throw new Error(`Invalid --frames "${args.frames}"`);
  }

  // Each worker is a whole browser, so this trades memory for wall clock. Two
  // cores are left for ffmpeg and the dev server that is serving the page.
  const maxWorkers = Math.max(1, Math.min(8, os.cpus().length - 2));
  const requested = args.workers ? Number(args.workers) : maxWorkers;
  const workers = Math.max(1, Math.min(requested, maxWorkers, durationInFrames));

  await mkdir(path.dirname(outPath), { recursive: true });

  const url = new URL(`${baseUrl}/render/${scene}`);
  if (sceneData) url.searchParams.set('d', JSON.stringify(sceneData));

  const chunkSize = Math.ceil(durationInFrames / workers);
  const chunks = [];
  for (let start = 0, i = 0; start < durationInFrames; start += chunkSize, i++) {
    chunks.push({
      startFrame: start,
      endFrame: Math.min(start + chunkSize, durationInFrames),
      target: `${outPath}.part${i}.mp4`,
    });
  }

  console.log(
    `Rendering ${scene}: ${durationInFrames} frames @ ${width}x${height} ${fps}fps ` +
      `(${chunks.length} worker${chunks.length === 1 ? '' : 's'}, ${format})`,
  );

  let completed = 0;
  const started = Date.now();
  const onFrame = () => {
    completed += 1;
    if (completed % 15 === 0 || completed === durationInFrames) {
      const pct = ((completed / durationInFrames) * 100).toFixed(0);
      process.stdout.write(`  ${completed}/${durationInFrames} (${pct}%)\r`);
    }
  };

  const listPath = path.join(os.tmpdir(), `render-${process.pid}-concat.txt`);
  try {
    await Promise.all(
      chunks.map((chunk) => renderChunk({ ...chunk, composition, url: url.toString(), onFrame })),
    );
    process.stdout.write('\n');

    if (chunks.length === 1) {
      // Nothing to join — the single segment already is the finished video.
      await rm(outPath, { force: true });
      const { rename } = await import('node:fs/promises');
      await rename(chunks[0].target, outPath);
    } else {
      await concatSegments(chunks.map((c) => c.target), listPath);
    }
  } finally {
    await Promise.all(
      chunks.map((c) => rm(c.target, { force: true }).catch(() => {})),
    );
    await rm(listPath, { force: true }).catch(() => {});
  }

  console.log(`Wrote ${outPath} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(`\nRender failed: ${err.message}`);
  process.exit(1);
});
