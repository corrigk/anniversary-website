// The wish jar: drop wishes in, draw one out at random. Wishes from the other
// person stay folded up (hidden) until they're drawn.
import { h, s, pageHead, empty, loading, editSheet, openSheet, iconBtn, toast, toastError, seeded } from '../ui.js';
import { supabase, q, isMissingFeature } from '../supabase.js';
import { db, state, nameOf, authorBadge } from '../data.js';
import { formatDateTime } from '../dates.js';
import { celebrateAt } from '../magic.js';

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Wish jar', 'Little wishes, waiting to be drawn.', () => openForm(null, load), '+ Wish'), box);

  async function load() {
    box.replaceChildren(loading('Peeking in the jar…'));
    let rows;
    try {
      rows = await q(supabase.from('wishes').select('*').order('created_at'));
    } catch (err) {
      if (!isMissingFeature(err)) toastError(err);
      box.replaceChildren(empty(isMissingFeature(err) ? 'The wish jar isn’t switched on yet. (Bubs: run supabase/extras.sql.)' : 'Couldn’t open the jar.', isMissingFeature(err) ? null : 'Try again', load));
      return;
    }
    const inJar = rows.filter((w) => !w.drawn_at);
    const drawn = rows.filter((w) => w.drawn_at).sort((a, b) => b.drawn_at.localeCompare(a.drawn_at));
    const mineInJar = inJar.filter((w) => w.created_by === state.user.id);

    const jarEl = jar(inJar);
    const drawBtn = h('button', { class: 'btn', type: 'button', disabled: !inJar.length, text: inJar.length ? '✨ Draw a wish' : 'The jar is empty' });
    drawBtn.addEventListener('click', () => draw(inJar, jarEl, drawBtn, load));

    box.replaceChildren(
      h('section', { class: 'card center jar-card' },
        jarEl,
        h('p', { class: 'muted', style: { margin: '.2rem 0 .8rem' }, 'aria-live': 'polite' },
          inJar.length ? `${inJar.length} wish${inJar.length === 1 ? '' : 'es'} glowing inside` : 'Drop the first wish in!'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          drawBtn,
          h('button', { class: 'btn ghost', type: 'button', text: 'Drop one in', onclick: () => openForm(null, load) })),
      ),
      mineInJar.length ? h('details', { class: 'group', style: { marginTop: '1rem' } },
        h('summary', {}, `Your wishes still in the jar (${mineInJar.length})`),
        h('section', { class: 'card' }, h('ul', { class: 'list' }, mineInJar.map((w) => h('li', { class: 'item' },
          h('div', { class: 'grow' }, w.text), iconBtn('Edit this wish', '✎', () => openForm(w, load))))))) : '',
      drawn.length ? h('h2', { style: { marginTop: '1.5rem' } }, 'Wishes we’ve drawn') : '',
      drawn.length ? h('section', { class: 'card' }, h('ul', { class: 'list' }, drawn.map((w) => drawnItem(w, load)))) : '',
    );
  }
  await load();
}

// A glass jar with one little light per wish inside.
function jar(inJar) {
  const svg = s('svg', { class: 'jar', viewBox: '0 0 200 240', role: 'img', 'aria-label': `A jar holding ${inJar.length} wishes` });
  svg.append(
    s('rect', { class: 'jar-lid', x: 58, y: 14, width: 84, height: 22, rx: 6 }),
    s('path', { class: 'jar-glass', d: 'M62 36 h76 v14 c26 12 34 34 34 62 v78 c0 22 -14 34 -34 34 h-76 c-20 0 -34 -12 -34 -34 v-78 c0 -28 8 -50 34 -62 z' }),
    s('path', { class: 'jar-shine', d: 'M48 98 c0 -18 6 -30 18 -38' }),
  );
  inJar.slice(0, 16).forEach((w, i) => {
    const x = 52 + seeded(w.id, 1) * 96;
    const y = 96 + seeded(w.id, 2) * 106;
    const g = s('g', { class: 'jar-wish', style: `animation-delay:${-seeded(w.id, 3) * 6}s; animation-duration:${4 + seeded(w.id, 4) * 4}s` });
    g.append(s('circle', { class: 'halo', cx: x, cy: y, r: 11 }), s('circle', { class: 'core', cx: x, cy: y, r: 3.4 }));
    svg.append(g);
    if (i % 2) g.classList.add('alt');
  });
  return svg;
}

async function draw(inJar, jarEl, btn, reload) {
  if (!inJar.length) return;
  btn.disabled = true;
  jarEl.classList.add('shaking');
  // Prefer a wish the OTHER person wrote: drawing your own is less fun.
  const theirs = inJar.filter((w) => w.created_by !== state.user.id);
  const pool = theirs.length ? theirs : inJar;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  try {
    const [row] = await Promise.all([
      db.patch('wishes', pick.id, { drawn_at: new Date().toISOString() }),
      new Promise((r) => setTimeout(r, 900)),
    ]);
    jarEl.classList.remove('shaking');
    celebrateAt(jarEl, { n: 40 });
    const from = nameOf(row.created_by);
    openSheet({
      title: from ? `A wish from ${from}` : 'A wish',
      body: h('div', { class: 'reward' }, h('p', { class: 'wish-text' }, row.text)),
      onClose: reload,
    });
  } catch (err) {
    jarEl.classList.remove('shaking');
    btn.disabled = false;
    toastError(err);
  }
}

function drawnItem(w, reload) {
  return h('li', { class: `item${w.granted ? ' done' : ''}` },
    h('button', {
      class: 'tick', type: 'button', role: 'checkbox', 'aria-checked': String(w.granted), 'aria-label': `Came true: ${w.text}`,
      onclick: async (e) => {
        if (!w.granted) celebrateAt(e.currentTarget, { n: 24 });
        try { await db.patch('wishes', w.id, { granted: !w.granted }); if (!w.granted) toast('A wish came true! 🌟'); reload(); }
        catch (err) { toastError(err); }
      },
    }, h('span', { 'aria-hidden': 'true' }, w.granted ? '✓' : '')),
    h('div', { class: 'grow' },
      h('div', {}, w.text),
      h('div', { class: 'row' }, authorBadge(w.created_by), h('span', { class: 'badge' }, `drawn ${formatDateTime(w.drawn_at)}${w.granted ? ' · came true' : ''}`)),
    ),
    iconBtn('Edit this wish', '✎', () => openForm(w, reload)),
  );
}

function openForm(w, reload) {
  editSheet({
    title: w ? 'Edit wish' : 'Make a wish',
    initial: w || {},
    saveText: w ? 'Save' : 'Drop it in',
    fields: [{ name: 'text', label: 'I wish…', type: 'textarea', rows: 3, required: true, max: 400, hint: w ? null : 'It stays folded up until someone draws it.' }],
    onDelete: w ? async () => { await db.remove('wishes', w.id); toast('Wish removed.'); reload(); } : null,
    onSave: async (v) => {
      if (w) await db.update('wishes', w.id, v); else await db.insert('wishes', v);
      toast(w ? 'Saved.' : 'Your wish is in the jar. ✨');
      reload();
    },
  });
}
