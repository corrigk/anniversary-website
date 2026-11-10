import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit', // reset links work even if opened in a different browser
    storageKey: 'bh-auth',
  },
});

// Unwrap a Supabase response, throwing a readable Error on failure.
export async function q(promise) {
  let { data, error, count } = await promise;
  // A flaky connection: retry reads once. (Awaiting a query builder again re-sends it.
  // Writes are never retried, so nothing can be saved twice.)
  if (error && isNetworkError(error) && (promise.method === 'GET' || promise.method === 'HEAD')) {
    await new Promise((r) => setTimeout(r, 700));
    ({ data, error, count } = await promise);
  }
  if (error) throw new Error(friendlyError(error));
  return count !== undefined && count !== null && data === null ? count : data;
}

const isNetworkError = (error) => /Failed to fetch|NetworkError|Load failed|network/i.test(error?.message || '');

// True when a table / function from supabase/extras.sql hasn't been created yet.
export const isMissingFeature = (err) => /schema cache|does not exist|Could not find the (table|function)|PGRST20[25]|42P01|42883/i.test(`${err?.message || ''} ${err?.code || ''}`);

export function friendlyError(error) {
  const msg = (error && (error.message || error.error_description)) || String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  if (/JWT|session|not authenticated|wrong key type|no suitable key|invalid claim|token is expired/i.test(msg)) return 'Your session expired. Please sign in again.';
  if (/row-level security|permission denied/i.test(msg)) return "That isn't allowed for this account.";
  if (isMissingFeature(error)) return 'This part isn’t switched on yet. (Bubs: run supabase/extras.sql.)';
  return msg;
}
