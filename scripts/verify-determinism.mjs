/**
 * Renders the same scene twice and asserts the two videos are byte-identical.
 *
 * This is the regression guard for the frame-seek rule. If a scene ever starts
 * driving GSAP by wall-clock time — a stray `.play()`, a CSS transition, a
 * `requestAnimationFrame` loop — the two renders diverge and this fails. That
 * matters because non-determinism shows up in the output as jitter, and jitter
 * is very hard to attribute after the fact.
 *
 * Usage: npm run verify:determinism -- --scene birthday
 */

import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

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
const baseUrl = args['base-url'] ?? 'http://localhost:3000';

function run(outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/render.mjs', '--scene', scene, '--out', outPath, '--base-url', baseUrl],
      { stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`render exited ${code}`)),
    );
  });
}

const outA = path.resolve(`out/.determinism-a-${scene}.mp4`);
const outB = path.resolve(`out/.determinism-b-${scene}.mp4`);

const sha = async (file) =>
  createHash('sha256').update(await readFile(file)).digest('hex');

try {
  console.log(`Determinism check for "${scene}" — rendering twice...`);
  await run(outA);
  await run(outB);

  const [hashA, hashB] = await Promise.all([sha(outA), sha(outB)]);
  console.log(`\n  run A: ${hashA}`);
  console.log(`  run B: ${hashB}`);

  if (hashA === hashB) {
    console.log('\nPASS — identical output. Scene is frame-deterministic.');
  } else {
    console.error(
      '\nFAIL — renders differ. Something in this scene is driven by wall-clock ' +
        'time rather than seek(frame / fps). Look for .play()/.resume(), a CSS ' +
        'transition or animation, Date.now(), or Math.random() in the scene.',
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Determinism check failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all([rm(outA, { force: true }), rm(outB, { force: true })]);
}
