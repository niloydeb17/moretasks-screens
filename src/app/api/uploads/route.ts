import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { EXT_BY_MIME, MAX_BYTES } from './shared';

/**
 * Issues the client token `@vercel/blob/client`'s `upload()` needs to send a
 * photo straight from the browser to Blob storage.
 *
 * The file's bytes never pass through this route, or through any Vercel
 * Function at all — only this tiny token request/response does. That's
 * deliberate: a Function's own request body has a platform size limit,
 * and routing a 5-10MB phone photo through it here is exactly what was
 * producing a 413 before a single byte of the photo reached this app's
 * own size check.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: Object.keys(EXT_BY_MIME),
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
