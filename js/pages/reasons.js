import { h, pageHead, empty, loading, editSheet, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, nameOf, authorBadge } from '../data.js';

export async function render(root) {
  const quote = h('p', { class: 'quote' });
  const by = h('p', { class: 'badge', style: { justifyContent: 'center', display: 'flex' } });
  const shuffle = h('button', { class: 'btn soft small', type: 'button', text: '🔀 Shuffle' });
  const card = h('section', { class: 'card reason-card', 'aria-live': 'polite' }, quote, by, shuffle);
  const box = h('div', { style: { marginTop: '1rem' } });
  let rows = [];
  let last = -1;

  root.append(pageHead('Reasons I love you', 'A list that will never be finished.', () => openForm(null, load), '+ Add'), card, box);

  shuffle.addEventListener('click', () => pick());
  function pick() {
    if (!rows.length) { card.hidden = true; return; }
    card.hidden = false;
    let i = Math.floor(Math.random() * rows.length);
    if (rows.length > 1 && i === last) i = (i + 1) % rows.length;
    last = i;
    quote.classList.add('fading');
    setTimeout(() => {
      quote.textContent = rows[i].text;
      const n = nameOf(rows[i].created_by);
      by.textContent = n ? `— ${n}` : '';
      quote.classList.remove('fading');
    }, 180);
  }

  async function load() {
    box.replaceChildren(loading());
    try {
      rows = await q(supabase.from('reasons').select('*').order('created_at', { ascending: true }));
      pick();
      box.replaceChildren(rows.length
        ? h('section', { class: 'card' }, h('ol', { class: 'list reasons-list' }, rows.map((r) => h('li', { class: 'item' },
            h('div', { class: 'grow' }, h('div', {}, r.text), authorBadge(r.created_by)),
            iconBtn('Edit this reason', '✎', () => openForm(r, load)),
          ))))
        : empty('No reasons yet. Add the first one!', '+ Add a reason', () => openForm(null, load)));
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load reasons.', 'Try again', load));
    }
  }
  await load();
}

function openForm(r, reload) {
  editSheet({
    title: r ? 'Edit reason' : 'A new reason',
    initial: r || {},
    fields: [{ name: 'text', label: 'I love you because…', type: 'textarea', rows: 3, required: true, max: 500 }],
    onDelete: r ? async () => { await db.remove('reasons', r.id); toast('Reason removed.'); reload(); } : null,
    onSave: async (v) => {
      if (r) await db.update('reasons', r.id, v); else await db.insert('reasons', v);
      toast(r ? 'Saved.' : 'Added! 💛');
      reload();
    },
  });
}
