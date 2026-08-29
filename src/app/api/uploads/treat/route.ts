import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { treatPortrait } from '../portrait';

/**
 * Runs the MVP portrait treatment on a photo that's already in Blob storage
 * (uploaded directly from the browser via the `handleUpload` token route
 * above) and stores the result as a new blob.
 *
 * Split out from that route because this step needs the actual image bytes
 * server-side — for `sharp` and the remove.bg call — which a client upload
 * never sends this app in the first place. Fetching them back by URL is an
 * outbound request the Function makes itself, so it isn't subject to the
 * inbound body-size limit that motivated the client-upload split.
 */
export async function POST(request: Request) {
  const { url } = await request.json().catch(() => ({}));
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'Expected a blob "url"' }, { status: 400 });
  }

  const source = await fetch(url);
  if (!source.ok) {
    return NextResponse.json(
      { error: `Could not read the uploaded photo (${source.status})` },
      { status: 400 },
    );
  }
  const original = Buffer.from(await source.arrayBuffer());

  const treated = await treatPortrait(original).catch((err: unknown) => ({
    buffer: original,
    backgroundRemoved: false,
    note: `Could not process the photo (${err instanceof Error ? err.message : String(err)}).`,
  }));

  const blob = await put(`${randomUUID()}.png`, treated.buffer, {
    access: 'public',
    contentType: 'image/png',
  });

  return NextResponse.json({
    url: blob.url,
    backgroundRemoved: treated.backgroundRemoved,
    note: treated.note,
  });
}
