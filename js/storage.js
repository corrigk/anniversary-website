// Private storage helpers: signed URLs (batched + cached), upload, delete.
import { supabase, friendlyError } from './supabase.js';
import { STORAGE_BUCKET } from './config.js';

const EXPIRES = 3600;              // seconds a signed URL is valid
const TTL = (EXPIRES - 300) * 1000; // reuse for a bit less than that
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
  const { error } = await bucket().upload(path, blob, { contentType: contentType || blob.type, upsert: false, cacheControl: '3600' });
  if (error) throw new Error(friendlyError(error));
  return path;
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  const { error } = await bucket().remove(list);
  list.forEach((p) => cache.delete(p));
  if (error) throw new Error(friendlyError(error));
}
