import { h, pageHead, empty, loading, editSheet, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, authorBadge } from '../data.js';

const SUGGESTED = ['Our first dance', 'Road trip', 'Songs that remind me of you', 'Slow and cozy', 'Hype'];
const OTHER = 'Other favorites';

export async function render(root) {
  const box = h('div');
  let categories = [];
  root.append(pageHead('Our songs', 'The soundtrack of us.', () => openForm(null, categories, load), '+ Add'), box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const rows = await q(supabase.from('songs').select('*').order('created_at'));
      const groups = new Map();
      for (const s of rows) {
        const c = s.category?.trim() || OTHER;
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(s);
      }
      categories = [...new Set([...SUGGESTED, ...groups.keys()])].filter((c) => c !== OTHER);
      if (!rows.length) {
        box.replaceChildren(empty('No songs yet. Add the first one!', '+ Add a song', () => openForm(null, categories, load)));
        return;
      }
      box.replaceChildren(...[...groups.entries()].map(([cat, songs]) => h('details', { class: 'group', open: true },
        h('summary', {}, h('span', { class: 'sprig', 'aria-hidden': 'true' }), cat, h('span', { class: 'muted small', style: { fontFamily: 'var(--font-body)' } }, ` (${songs.length})`)),
        h('div', { class: 'card' }, songs.map((s) => song(s, () => openForm(s, categories, load)))),
      )));
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load songs.', 'Try again', load));
    }
  }
  await load();
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

function song(s, onEdit) {
  const link = s.url && safeUrl(s.url);
  return h('div', { class: 'song' },
    h('div', {},
      h('h3', {}, s.title),
      s.artist ? h('div', { class: 'muted' }, s.artist) : null,
    ),
    iconBtn(`Edit “${s.title}”`, '✎', onEdit),
    s.note ? h('p', { class: 'pre', style: { gridColumn: '1 / -1', margin: '.2rem 0 0' } }, s.note) : null,
    h('div', { class: 'row', style: { gridColumn: '1 / -1' } },
      link ? h('a', { class: 'btn soft small', href: link, target: '_blank', rel: 'noopener noreferrer' }, '▶ Listen ↗') : null,
      authorBadge(s.created_by),
    ),
  );
}

function openForm(s, categories, reload) {
  editSheet({
    title: s ? 'Edit song' : 'Add a song',
    initial: s || {},
    fields: [
      { name: 'title', label: 'Song', required: true, max: 120 },
      { name: 'artist', label: 'Artist', max: 120 },
      { name: 'category', label: 'Category', max: 60, suggestions: categories, hint: 'Pick one or type your own.' },
      { name: 'note', label: 'Why it matters', type: 'textarea', rows: 3 },
      { name: 'url', label: 'Link', type: 'url', inputmode: 'url', placeholder: 'https://…' },
    ],
    onDelete: s ? async () => { await db.remove('songs', s.id); toast('Song removed.'); reload(); } : null,
    onSave: async (v) => {
      if (s) await db.update('songs', s.id, v); else await db.insert('songs', v);
      toast('Saved. 🎵');
      reload();
    },
  });
}
