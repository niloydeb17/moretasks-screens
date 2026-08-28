import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { MIME_BY_EXT, UPLOADS_DIR } from '../shared';

/**
 * Serves a file the POST route above wrote into the OS temp dir.
 *
 * This is what makes storing uploads outside `public/` possible at all —
 * Next.js can only serve a static asset that's a real file already inside the
 * project, so anything living elsewhere has to be read and returned by hand.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // The name is always one this route itself generated (a UUID + known
  // extension), but validate anyway — it arrives back through a URL.
  if (!/^[a-f0-9-]+\.(png|jpg|webp|gif)$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  try {
    const bytes = await readFile(path.join(UPLOADS_DIR, filename));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
