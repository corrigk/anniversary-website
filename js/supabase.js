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
  const { data, error, count } = await promise;
  if (error) throw new Error(friendlyError(error));
  return count !== undefined && count !== null && data === null ? count : data;
}

export function friendlyError(error) {
  const msg = (error && (error.message || error.error_description)) || String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  if (/JWT|session|not authenticated/i.test(msg)) return 'Your session expired. Please sign in again.';
  if (/row-level security|permission denied/i.test(msg)) return "That isn't allowed for this account.";
  return msg;
}
