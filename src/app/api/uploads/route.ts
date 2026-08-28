import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { MAX_BYTES, EXT_BY_MIME, UPLOADS_DIR } from './shared';
import { treatPortrait } from './portrait';

/**
 * Stores an uploaded image under the OS temp dir — deliberately *outside* the
 * project folder, not `public/uploads` — and returns a URL the `[filename]`
 * route below serves it back from.
 *
 * A real file on disk — not a blob: URL — is what makes an uploaded photo
 * usable in an actual render: `scripts/render.mjs` drives a *separate*
 * headless browser process hitting this same Next.js server, which can fetch
 * `/api/uploads/<id>.png` like any other URL but has no access to a blob: URL
 * that only ever existed in the admin's own browser tab. Serving it through
 * this API route (rather than `public/`, which Next.js can only serve from a
 * real file already inside the project) is what makes the temp-dir location
 * possible at all.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Expected a "file" field' }, { status: 400 });
  }

  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported image type "${file.type}"` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 10MB limit' }, { status: 400 });
  }

  await mkdir(UPLOADS_DIR, { recursive: true });

  const original = Buffer.from(await file.arrayBuffer());

  /**
   * `treat` asks for the MVP portrait treatment: background out, desaturated,
   * framed to the chest, laid out on the design's own canvas. See `./portrait`,
   * including the note about the photo being sent to a third party.
   *
   * Opt-in per request rather than a server setting, because it is the panel's
   * toggle that decides — and because it is the one thing here that sends the
   * image somewhere, it should never happen without the caller asking.
   */
  if (form?.get('treat') === '1') {
    const treated = await treatPortrait(original).catch((err: unknown) => ({
      buffer: original,
      backgroundRemoved: false,
      note: `Could not process the photo (${err instanceof Error ? err.message : String(err)}).`,
    }));

    // Always a .png: the treatment produces transparency, which the source
    // format may not carry.
    const filename = `${randomUUID()}.png`;
    await writeFile(path.join(UPLOADS_DIR, filename), treated.buffer);
    return NextResponse.json({
      url: `/api/uploads/${filename}`,
      backgroundRemoved: treated.backgroundRemoved,
      note: treated.note,
    });
  }

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOADS_DIR, filename), original);

  return NextResponse.json({ url: `/api/uploads/${filename}` });
}
