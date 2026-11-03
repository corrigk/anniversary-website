import { h, pageHead, empty, loading, editSheet, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, authorBadge } from '../data.js';
import { todayISO, formatDate } from '../dates.js';
import { celebrateAt } from '../magic.js';

export async function render(root) {
  const bar = h('i', { style: { width: '0%' } });
  const label = h('p', { class: 'muted small', style: { margin: '.4rem 0 0' } });
  const progress = h('section', { class: 'card' },
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Bucket list progress', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar),
    label);
  const box = h('div', { style: { marginTop: '1rem' } });
  root.append(pageHead('Bucket list', 'Someday, together.', () => openForm(null, load), '+ Add'), progress, box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const rows = await q(supabase.from('bucket_items').select('*').order('created_at'));
      const todo = rows.filter((r) => !r.done);
      const done = rows.filter((r) => r.done).sort((a, b) => (b.done_on || '').localeCompare(a.done_on || ''));
      const pct = rows.length ? Math.round((done.length / rows.length) * 100) : 0;
      requestAnimationFrame(() => { bar.style.width = `${pct}%`; });
      bar.parentElement.setAttribute('aria-valuenow', String(pct));
      label.textContent = rows.length ? `${done.length} of ${rows.length} done${pct === 100 ? ' — time to dream up more!' : ''}` : '';
      progress.hidden = !rows.length;
      if (!rows.length) {
        box.replaceChildren(empty('Nothing here yet. Add the first dream!', '+ Add an item', () => openForm(null, load)));
        return;
      }
      box.replaceChildren(
        todo.length ? h('section', { class: 'card' }, h('ul', { class: 'list' }, todo.map((r) => item(r, load)))) : h('p', { class: 'muted center' }, 'Everything’s checked off! ✨'),
        done.length ? h('h2', { style: { marginTop: '1.5rem' } }, 'Done') : '',
        done.length ? h('section', { class: 'card' }, h('ul', { class: 'list' }, done.map((r) => item(r, load)))) : '',
      );
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load the bucket list.', 'Try again', load));
    }
  }
  await load();
}

function item(r, reload) {
  return h('li', { class: `item${r.done ? ' done' : ''}` },
    h('button', {
      class: 'tick', type: 'button', role: 'checkbox', 'aria-checked': String(r.done), 'aria-label': r.text,
      onclick: async (e) => {
        if (!r.done) celebrateAt(e.currentTarget, { n: 26 });
        try {
          await db.patch('bucket_items', r.id, r.done ? { done: false, done_on: null } : { done: true, done_on: todayISO() });
          if (!r.done) toast('Checked off! 🎉');
          reload();
        } catch (err) { toastError(err); }
      },
    }, h('span', { 'aria-hidden': 'true' }, r.done ? '✓' : '')),
    h('div', { class: 'grow' },
      h('div', { class: 'txt' }, r.text),
      r.done && r.done_on ? h('div', { class: 'muted small' }, `Done ${formatDate(r.done_on)}`) : authorBadge(r.created_by),
    ),
    iconBtn(`Edit “${r.text}”`, '✎', () => openForm(r, reload)),
  );
}

function openForm(r, reload) {
  editSheet({
    title: r ? 'Edit item' : 'Add to the bucket list',
    initial: r || {},
    fields: [
      { name: 'text', label: 'Someday we’ll…', required: true, max: 200 },
      ...(r ? [
        { name: 'done', label: 'Done!', type: 'checkbox' },
        { name: 'done_on', label: 'Done on', type: 'date' },
      ] : []),
    ],
    onDelete: r ? async () => { await db.remove('bucket_items', r.id); toast('Removed.'); reload(); } : null,
    onSave: async (v) => {
      if (r) {
        await db.update('bucket_items', r.id, {
          text: v.text, done: !!v.done,
          done_on: v.done ? (v.done_on || todayISO()) : null,
        });
      } else {
        await db.insert('bucket_items', { text: v.text });
      }
      toast('Saved.');
      reload();
    },
  });
}
