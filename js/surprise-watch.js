// Watches for timed surprises while the site is open. When the next one
// unlocks, a burst of petals and a toast announce it wherever she is.
// Only timing ever reaches the browser early; the note itself stays on the
// server until its moment (see supabase/extras.sql).
import { supabase } from './supabase.js';
import { state } from './data.js';
import { toastAction } from './ui.js';
import { celebrate } from './magic.js';

let timer = null;
let running = false;
const MAX_WAIT = 12 * 3600 * 1000;

export function startSurpriseWatch() {
  if (running) return;
  running = true;
  check();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user) check(); });
}

export function stopSurpriseWatch() {
  clearTimeout(timer);
}

async function check() {
  clearTimeout(timer);
  if (!state.user) return;
  let data;
  try {
    const res = await supabase.rpc('surprises_waiting');
    if (res.error) return; // feature not set up, or offline: stay quiet
    data = res.data;
  } catch { return; }
  if (!data || !data.locked || data.seconds_remaining === null || data.seconds_remaining === undefined) return;
  const ms = Math.max(0, data.seconds_remaining * 1000) + 1500;
  if (ms > MAX_WAIT) return; // too far off; we'll look again next visit
  timer = setTimeout(announce, ms);
}

function announce() {
  if (!state.user) return;
  celebrate(undefined, undefined, { n: 60 });
  window.dispatchEvent(new CustomEvent('bh:surprise'));
  if (!location.hash.startsWith('#/surprises')) {
    toastAction('💝 A little surprise just arrived for you', 'Open it', () => { location.hash = '#/surprises'; });
  }
  check(); // line up the next one
}

// Unlocked notes from the other person that haven't been opened yet.
export async function unseenSurprises() {
  const { data, error } = await supabase.from('surprises')
    .select('id', { count: 'exact' })
    .is('seen_at', null)
    .neq('created_by', state.user.id)
    .lte('unlock_at', new Date().toISOString());
  if (error) return 0;
  return data?.length || 0;
}
