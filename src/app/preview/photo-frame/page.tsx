import { redirect } from 'next/navigation';

/** This page moved to the app's home page (`/`) — redirect so any existing
 *  bookmarks or links still land somewhere real. */
export default function PhotoFramePreviewRedirect() {
  redirect('/');
}
