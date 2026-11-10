// Private storage helpers: signed URLs (batched + cached), upload, delete.
import { supabase, friendlyError } from './supabase.js';
import { STORAGE_BUCKET } from './config.js';

const EXPIRES = 4 * 3600;          // seconds a signed URL is valid (long enough for a slow evening of scrolling)
const TTL = (EXPIRES - 600) * 1000; // reuse for a bit less than that
const cache = new Map();           // path -> { url, until }

const bucket = () => supabase.storage.from(STORAGE_BUCKET);

export async function signedUrls(paths) {
  const now = Date.now();
  const want = [...new Set(paths.filter(Boolean))].filter((p) => !(cache.get(p)?.until > now));
  for (let i = 0; i < want.length; i += 100) {
    const chunk = want.slice(i, i + 100);
    const { data, error } = await bucket().createSignedUrls(chunk, EXPIRES);
    if (error) throw new Error(friendlyError(error));
    for (const row of data || []) {
      if (row.signedUrl) cache.set(row.path, { url: row.signedUrl, until: now + TTL });
    }
  }
  const out = {};
  for (const p of paths) if (p && cache.has(p)) out[p] = cache.get(p).url;
  return out;
}

export async function signedUrl(path) {
  return (await signedUrls([path]))[path] || null;
}

export async function upload(path, blob, contentType) {
  const opts = { contentType: contentType || blob.type, cacheControl: '3600' };
  let { error } = await bucket().upload(path, blob, { ...opts, upsert: false });
  if (error) {
    // One more try on a shaky connection (upsert, in case the first attempt half-landed).
    await new Promise((r) => setTimeout(r, 900));
    ({ error } = await bucket().upload(path, blob, { ...opts, upsert: true }));
  }
  if (error) throw new Error(friendlyError(error));
  return path;
}

// Forget a cached signed URL (e.g. the image failed to load) and sign it again.
export async function refreshSignedUrl(path) {
  cache.delete(path);
  return signedUrl(path);
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  const { error } = await bucket().remove(list);
  list.forEach((p) => cache.delete(p));
  if (error) throw new Error(friendlyError(error));
}
