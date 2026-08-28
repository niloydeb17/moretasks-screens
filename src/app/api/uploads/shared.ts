import os from 'node:os';
import path from 'node:path';

export const MAX_BYTES = 10 * 1024 * 1024;

export const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);

/**
 * Where uploaded photos actually live on disk: the OS temp dir, not
 * `public/uploads` — an admin's uploads are scratch data for a render, not
 * project assets, and shouldn't sit inside the app's own folder (synced,
 * backed up, or committed alongside it) just to be reachable by URL.
 */
export const UPLOADS_DIR = path.join(os.tmpdir(), 'moretasks-screens-uploads');
