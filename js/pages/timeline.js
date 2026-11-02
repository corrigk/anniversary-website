import { h, pageHead, empty, loading, iconBtn, editSheet, confirmDialog, toast, toastError, sprig, uuid } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, authorBadge } from '../data.js';
import { signedUrls, upload, removeFiles } from '../storage.js';
import { processPhoto } from '../image.js';
import { formatDate, monthName, parseDate, todayISO } from '../dates.js';

const PAGE = 12;
const MAX_PHOTOS = 6;

export async function render(root) {
  const opts = { ascending: false, year: '', search: '' };
  let offset = 0;
  let done = false;
  let busy = false;
  let lastYear = null, lastMonth = null;
  let locations = [];

  const sortBtn = h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Change sort order' });
  const yearSel = h('select', { class: 'input', 'aria-label': 'Filter by year' }, h('option', { value: '' }, 'All years'));
  const search = h('input', { class: 'input search', type: 'search', placeholder: 'Search words or places…', 'aria-label': 'Search memories', enterkeyhint: 'search' });
  const list = h('div', { class: 'tl' });
  const more = h('div', { class: 'load-more' });
  const sentinel = h('div', { 'aria-hidden': 'true', style: { height: '1px' } });
  const setSortLabel = () => { sortBtn.textContent = opts.ascending ? '↑ Oldest first' : '↓ Newest first'; };
  setSortLabel();

  root.append(
    pageHead('Our timeline', 'Every little chapter.', () => openMemoryForm(null, reload), '+ Add'),
    h('div', { class: 'toolbar' }, yearSel, sortBtn, search),
    list, sentinel, more,
  );

  sortBtn.addEventListener('click', () => { opts.ascending = !opts.ascending; setSortLabel(); reload(); });
  yearSel.addEventListener('change', () => { opts.year = yearSel.value; reload(); });
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { opts.search = search.value; reload(); }, 300); });

  async function loadMeta() {
    const rows = await q(supabase.from('memories').select('happened_on, location_text'));
    const years = [...new Set(rows.map((r) => r.happened_on?.slice(0, 4)).filter(Boolean))].sort().reverse();
    yearSel.replaceChildren(h('option', { value: '' }, 'All years'), ...years.map((y) => h('option', { value: y }, y)));
    yearSel.value = opts.year;
    locations = [...new Set(rows.map((r) => r.location_text?.trim()).filter(Boolean))].sort();
  }

  async function reload() {
    offset = 0; done = false; lastYear = lastMonth = null;
    list.replaceChildren(loading('Turning the pages…'));
    more.replaceChildren();
    loadMeta().catch(toastError);
    await loadPage(true);
  }

  async function loadPage(first = false) {
    if (busy || done) return;
    busy = true;
    try {
      let query = supabase.from('memories').select('*, memory_photos(id, storage_path, thumb_path, sort_order)')
        .order('happened_on', { ascending: opts.ascending })
        .order('created_at', { ascending: opts.ascending })
        .range(offset, offset + PAGE - 1);
      if (opts.year) query = query.gte('happened_on', `${opts.year}-01-01`).lte('happened_on', `${opts.year}-12-31`);
      const s = opts.search.replace(/[,()%*\\:"'.]/g, ' ').trim();
      if (s) query = query.or(`title.ilike.%${s}%,caption.ilike.%${s}%,location_text.ilike.%${s}%`);
      const rows = await q(query);
      rows.forEach((r) => r.memory_photos.sort((a, b) => a.sort_order - b.sort_order));
      const urls = await signedUrls(rows.flatMap((r) => r.memory_photos.map((p) => p.thumb_path || p.storage_path))).catch((e) => { toastError(e); return {}; });

      if (first) list.replaceChildren();
      if (first && !rows.length) {
        list.append(opts.search || opts.year
          ? empty('No memories match that. Try another word or year.')
          : empty('Nothing here yet. Add the first memory!', '+ Add a memory', () => openMemoryForm(null, reload)));
      }
      for (const m of rows) {
        const p = parseDate(m.happened_on);
        if (p.y !== lastYear) { list.append(h('h2', { class: 'tl-group year' }, sprig(), String(p.y))); lastYear = p.y; lastMonth = null; }
        if (p.m !== lastMonth) { list.append(h('h3', { class: 'tl-group' }, monthName(p.m))); lastMonth = p.m; }
        list.append(memoryCard(m, urls, reload));
      }
      offset += rows.length;
      done = rows.length < PAGE;
      more.replaceChildren(done
        ? (offset > 0 ? h('p', { class: 'muted small center' }, opts.ascending ? '…and here we are now. ♡' : '…and that’s where it all began. ♡') : '')
        : h('button', { class: 'btn ghost', type: 'button', onclick: () => loadPage(), text: 'Show more memories' }));
    } catch (err) {
      toastError(err);
      if (first) list.replaceChildren(empty('Couldn’t load memories.', 'Try again', reload));
    } finally {
      busy = false;
    }
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((e) => { if (e[0].isIntersecting && offset > 0) loadPage(); }, { rootMargin: '600px' })
    : null;
  io?.observe(sentinel);

  // locations are read lazily by the form for suggestions
  openMemoryForm.locations = () => locations;
  await reload();
  return () => io?.disconnect();
}

// ---------------------------------------------------------------------
function memoryCard(m, urls, onChange) {
  const photos = m.memory_photos;
  const card = h('article', { class: 'card tl-card' });
  if (photos.length) {
    const car = h('div', { class: 'carousel' }, photos.map((p, i) => h('button', {
      type: 'button', 'aria-label': `Open photo ${i + 1} of ${photos.length}`, onclick: () => lightbox(photos, i, m.title),
    }, h('img', { src: urls[p.thumb_path || p.storage_path] || '', alt: photos.length > 1 ? `${m.title} (${i + 1})` : m.title, loading: 'lazy', decoding: 'async' }))));
    card.append(h('div', { style: { position: 'relative' } }, car, photos.length > 1 ? h('span', { class: 'photo-count' }, `📷 ${photos.length}`) : null));
  }
  card.append(h('div', { class: 'tl-body' },
    h('div', { class: 'tl-date' }, formatDate(m.happened_on, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })),
    h('h3', { class: 'tl-title' }, m.title),
    m.caption ? h('p', { class: 'pre' }, m.caption) : null,
    h('div', { class: 'card-actions' },
      m.location_text ? h('span', { class: 'chip' }, '📍 ', m.location_text) : null,
      authorBadge(m.created_by),
      h('span', { class: 'spacer' }),
      iconBtn(`Edit “${m.title}”`, '✎', () => openMemoryForm(m, onChange)),
      iconBtn(`Delete “${m.title}”`, '🗑', async () => {
        if (!(await confirmDialog(`Delete “${m.title}” and its photos? This can’t be undone.`, { ok: 'Delete', danger: true }))) return;
        try { await deleteMemory(m); toast('Memory deleted.'); onChange(); } catch (err) { toastError(err); }
      }),
    ),
  ));
  return card;
}

async function deleteMemory(m) {
  const photos = m.memory_photos || await q(supabase.from('memory_photos').select('storage_path, thumb_path').eq('memory_id', m.id));
  await removeFiles(photos.flatMap((p) => [p.storage_path, p.thumb_path]));
  await db.remove('memories', m.id);
}

// ---------------------------------------------------------------------
// Lightbox: full-size photos, swipe (scroll-snap), arrows, Escape.
async function lightbox(photos, start, title) {
  const prevFocus = document.activeElement;
  const track = h('div', { class: 'lb-track' });
  const count = h('div', { class: 'lb-count', 'aria-live': 'polite' });
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); document.body.style.overflow = ''; prevFocus?.focus?.(); };
  const go = (d) => track.scrollBy({ left: d * track.clientWidth, behavior: 'smooth' });
  const closeBtn = iconBtn('Close photos', '✕', close);
  closeBtn.classList.add('lb-close');
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Photos: ${title}` },
    track, closeBtn,
    photos.length > 1 ? Object.assign(iconBtn('Previous photo', '‹', () => go(-1)), { className: 'icon-btn lb-nav lb-prev' }) : null,
    photos.length > 1 ? Object.assign(iconBtn('Next photo', '›', () => go(1)), { className: 'icon-btn lb-nav lb-next' }) : null,
    photos.length > 1 ? count : null,
  );
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }
  document.addEventListener('keydown', onKey, true);
  document.body.style.overflow = 'hidden';
  document.body.append(box);
  closeBtn.focus();

  let urls = {};
  try { urls = await signedUrls(photos.map((p) => p.storage_path)); } catch (err) { toastError(err); }
  photos.forEach((p, i) => track.append(h('figure', {},
    h('img', { src: urls[p.storage_path] || '', alt: photos.length > 1 ? `${title} (${i + 1} of ${photos.length})` : title, decoding: 'async' }))));
  const update = () => { count.textContent = `${Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) + 1} / ${photos.length}`; };
  track.addEventListener('scroll', update, { passive: true });
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; update(); });
}

// ---------------------------------------------------------------------
// Add / edit form with the photo pipeline.
function openMemoryForm(m, onDone) {
  const items = (m?.memory_photos || []).map((p) => ({ kind: 'existing', ...p, url: null }));
  const removed = [];
  const grid = h('div', { class: 'photo-grid' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Add photos' });

  function renderGrid() {
    const tiles = items.map((it, i) => {
      const img = it.kind === 'existing' ? it.url : it.preview;
      return h('div', { class: 'photo-tile' },
        img ? h('img', { src: img, alt: `Photo ${i + 1}` }) : h('div', { class: 'busy' }, it.status === 'processing' ? 'Preparing…' : ''),
        h('div', { class: 'ctrl' },
          h('button', { type: 'button', 'aria-label': `Move photo ${i + 1} earlier`, disabled: i === 0, onclick: () => { move(i, -1); }, text: '◀' }),
          h('button', { type: 'button', 'aria-label': `Remove photo ${i + 1}`, onclick: () => { removeAt(i); }, text: '✕' }),
          h('button', { type: 'button', 'aria-label': `Move photo ${i + 1} later`, disabled: i === items.length - 1, onclick: () => { move(i, 1); }, text: '▶' }),
        ),
      );
    });
    if (items.length < MAX_PHOTOS) {
      tiles.push(h('label', { class: 'photo-add' }, fileInput, h('span', {}, '＋', h('br'), 'Add photos')));
    }
    grid.replaceChildren(...tiles);
  }
  function move(i, d) { const j = i + d; [items[i], items[j]] = [items[j], items[i]]; renderGrid(); }
  function removeAt(i) {
    const [it] = items.splice(i, 1);
    if (it.kind === 'existing') removed.push(it);
    else if (it.preview) URL.revokeObjectURL(it.preview);
    renderGrid();
  }

  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    const room = MAX_PHOTOS - items.length;
    if (files.length > room) toast(`Up to ${MAX_PHOTOS} photos per memory. Added the first ${room}.`);
    for (const file of files.slice(0, room)) {
      const it = { kind: 'new', status: 'processing' };
      items.push(it);
      it.ready = processPhoto(file).then((res) => {
        Object.assign(it, res, { status: 'ready' });
        renderGrid();
      }).catch((err) => {
        toastError(err);
        const idx = items.indexOf(it);
        if (idx >= 0) items.splice(idx, 1);
        renderGrid();
      });
    }
    renderGrid();
  });

  if (items.length) {
    signedUrls(items.map((p) => p.thumb_path || p.storage_path)).then((urls) => {
      items.forEach((it) => { if (it.kind === 'existing') it.url = urls[it.thumb_path || it.storage_path]; });
      renderGrid();
    }).catch(toastError);
  }
  renderGrid();

  const photoField = h('div', { class: 'field' },
    h('span', {}, 'Photos ', h('span', { class: 'muted small', style: { fontWeight: 400 } }, `(up to ${MAX_PHOTOS}, resized automatically)`)),
    grid);

  editSheet({
    title: m ? 'Edit memory' : 'New memory',
    initial: m || { happened_on: todayISO() },
    fields: [
      { name: 'happened_on', label: 'Date', type: 'date', required: true },
      { name: 'title', label: 'Title', required: true, max: 120, placeholder: 'The day we…' },
      { name: 'caption', label: 'Caption', type: 'textarea', rows: 4, placeholder: 'What do you remember?' },
      { name: 'location_text', label: 'Location', max: 120, placeholder: 'Where were we?', suggestions: openMemoryForm.locations?.() || [] },
    ],
    extra: photoField,
    onDelete: m ? async () => { await deleteMemory(m); toast('Memory deleted.'); onDone(); } : null,
    onSave: async (v, { progress }) => {
      if (items.some((it) => it.status === 'processing')) {
        progress('Preparing photos…');
        await Promise.all(items.map((it) => it.ready).filter(Boolean));
      }
      const row = { happened_on: v.happened_on, title: v.title, caption: v.caption, location_text: v.location_text };
      const memory = m ? await db.update('memories', m.id, row) : await db.insert('memories', row);

      if (removed.length) {
        await removeFiles(removed.flatMap((p) => [p.storage_path, p.thumb_path])).catch(toastError);
        await q(supabase.from('memory_photos').delete().in('id', removed.map((p) => p.id)));
      }

      const fresh = items.filter((it) => it.kind === 'new' && it.status === 'ready');
      let n = 0, failed = 0;
      for (const [i, it] of items.entries()) {
        if (it.kind === 'existing') {
          if (it.sort_order !== i) await db.patch('memory_photos', it.id, { sort_order: i });
          continue;
        }
        if (it.status !== 'ready') continue;
        progress(`Uploading ${++n} of ${fresh.length}…`);
        const base = `${memory.id}/${uuid()}`;
        try {
          await upload(`${base}.jpg`, it.full, 'image/jpeg');
          await upload(`${base}_thumb.jpg`, it.thumb, 'image/jpeg');
          await db.insert('memory_photos', { memory_id: memory.id, storage_path: `${base}.jpg`, thumb_path: `${base}_thumb.jpg`, sort_order: i });
          URL.revokeObjectURL(it.preview);
        } catch (err) {
          failed++;
          console.warn(err);
          removeFiles([`${base}.jpg`, `${base}_thumb.jpg`]).catch(() => {});
        }
      }
      toast(failed ? `Saved, but ${failed} photo${failed > 1 ? 's' : ''} didn’t upload. Try adding ${failed > 1 ? 'them' : 'it'} again.` : (m ? 'Memory updated.' : 'Memory added! ♡'), failed ? 'error' : 'info');
      onDone();
    },
  });
}
