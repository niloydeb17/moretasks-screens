import { NextResponse } from 'next/server';
import { BUILT_SCENES } from '@/lib/compositions';

/**
 * Composition metadata for the render script.
 *
 * The renderer needs each scene's size, fps, and frame count. Serving them from
 * the same registry the scenes use keeps one source of truth — otherwise the
 * script and the app could disagree about duration and silently truncate video.
 */
export function GET() {
  return NextResponse.json({ compositions: BUILT_SCENES });
}
