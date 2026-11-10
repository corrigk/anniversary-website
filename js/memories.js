// Shared access to the timeline for the pages that reimagine it (Home's
// "this day" card, the secret garden, the constellation).
import { h, openSheet } from './ui.js';
import { supabase, q } from './supabase.js';
import { authorBadge, state } from './data.js';
import { signedUrls } from './storage.js';
import { formatDate, parseDate, today, daysBetween } from './dates.js';

let cache = null;
let cachedAt = 0;

// Every memory, oldest first, with its photos. Cached briefly so hopping
// between pages doesn't refetch.
export async function loadMemories({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < 60000) return cache;
  const rows = await q(supabase.from('memories')
    .select('id, happened_on, title, caption, location_text, created_by, memory_photos(*)')
    .order('happened_on', { ascending: true })
    .order('created_at', { ascending: true }));
  rows.forEach((r) => r.memory_photos.sort((a, b) => a.sort_order - b.sort_order));
  cache = rows;
  cachedAt = Date.now();
  return rows;
}
export const forgetMemories = () => { cache = null; };

// "3 years ago today", "2 years ago this week"
export function agoLabel(m, now = today()) {
  const p = parseDate(m.happened_on);
  const years = now.y - p.y;
  const sameDay = p.m === now.m && p.d === now.d;
  const when = years === 0 ? 'Earlier this year' : `${years} year${years === 1 ? '' : 's'} ago`;
  return sameDay ? `${when} today` : `${when} this week`;
}

// Memories that happened on today's month/day in an earlier year; if there
// are none, anything within three days either side.
export function onThisDay(rows, now = today()) {
  const past = rows.filter((m) => parseDate(m.happened_on).y < now.y);
  const exact = past.filter((m) => { const p = parseDate(m.happened_on); return p.m === now.m && p.d === now.d; });
  if (exact.length) return { exact: true, items: exact };
  const near = past.filter((m) => {
    const p = parseDate(m.happened_on);
    return Math.abs(daysBetween(now, { y: now.y, m: p.m, d: p.d })) <= 3;
  });
  return { exact: false, items: near };
}

// Show one memory in a sheet: photos (tap to enlarge), date, story, place.
export async function openMemory(m, { kicker } = {}) {
  const photos = m.memory_photos || [];
  const strip = photos.length ? h('div', { class: 'carousel', style: { borderRadius: 'var(--radius)' } }) : null;
  const sheet = openSheet({
    title: m.title,
    body: h('div', {},
      kicker ? h('p', { class: 'tl-date', style: { marginTop: 0 } }, kicker) : null,
      strip,
      h('p', { class: 'tl-date', style: { marginTop: strip ? '.8rem' : 0 } }, formatDate(m.happened_on, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
      m.caption ? h('p', { class: 'pre', style: { fontSize: '1.08rem' } }, m.caption) : null,
      h('div', { class: 'row' },
        m.location_text ? h('span', { class: 'chip' }, '📍 ', m.location_text) : null,
        authorBadge(m.created_by),
      ),
    ),
    footer: [h('span', { class: 'spacer' }), h('a', { class: 'btn ghost small', href: `#/timeline?year=${m.happened_on.slice(0, 4)}` }, 'See it on the timeline')],
  });
  if (strip) {
    try {
      const { photoImg, lightbox } = await import('./pages/timeline.js');
      const { focusOf } = await import('./focus.js');
      const urls = await signedUrls(photos.map((p) => p.storage_path));
      photos.forEach((p, i) => strip.append(h('button', {
        type: 'button', 'aria-label': `Open photo ${i + 1} of ${photos.length}`, onclick: () => lightbox(photos, i, m.title),
      }, photoImg(p.storage_path, urls[p.storage_path], m.title, false, focusOf(p)))));
    } catch (err) { console.warn(err); }
  }
  return sheet;
}

export const mine = (m) => m.created_by === state.user?.id;
