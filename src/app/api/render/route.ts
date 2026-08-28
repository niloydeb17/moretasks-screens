import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getComposition } from '@/lib/compositions';
import { resolveDurationInFrames } from '@/lib/duration';
import { decodeSceneData } from '@/lib/sceneData';

/**
 * Renders a composition to MP4 and returns the file, for a UI "download video"
 * button.
 *
 * Deliberately a thin wrapper around `scripts/render.mjs` rather than a second
 * implementation: that script is what `npm run render` and the determinism
 * check already exercise, so reusing it here means this route can only ever be
 * as correct (or as broken) as the CLI path already proven to work — never a
 * separate, silently-diverging render path.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof (body as { scene?: unknown }).scene !== 'string') {
    return NextResponse.json({ error: 'Expected a JSON body: { scene, data }' }, { status: 400 });
  }

  const { scene, data } = body as { scene: string; data?: unknown };
  const composition = getComposition(scene);
  if (!composition) {
    return NextResponse.json({ error: `Unknown scene "${scene}"` }, { status: 400 });
  }

  const outDir = path.join(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `api-render-${randomUUID()}.mp4`);

  const args = [
    path.join(process.cwd(), 'scripts', 'render.mjs'),
    '--scene', scene,
    '--out', outPath,
    // The child process launches its own browser/ffmpeg but still talks to
    // *this* running server for the page to capture — its own origin, not a
    // hardcoded one, so this works whatever port the app happens to be on.
    '--base-url', new URL(request.url).origin,
  ];
  if (data !== undefined) {
    args.push('--data', JSON.stringify(data));
    // Birthday's length depends on how many people share the day, so the
    // static composition number would truncate a multi-person clip. Resolve it
    // here (through the same helper the page uses) and pass it down.
    const resolved = decodeSceneData(
      encodeURIComponent(JSON.stringify(data)),
      composition.defaults,
    );
    args.push('--frames', String(resolveDurationInFrames(composition, resolved)));
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, args, { stdio: 'inherit' });
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`render exited ${code}`))));
    });

    const video = await readFile(outPath);
    return new NextResponse(new Uint8Array(video), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${scene}.mp4"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Render failed: ${message}` }, { status: 500 });
  } finally {
    await rm(outPath, { force: true });
  }
}
