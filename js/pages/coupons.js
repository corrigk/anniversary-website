import { h, pageHead, empty, loading, editSheet, confirmDialog, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, authorBadge } from '../data.js';
import { formatDateTime } from '../dates.js';
import { celebrateAt } from '../magic.js';

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Coupon booklet', 'Good for one of anything on this page.', () => openForm(null, load), '+ Add'), box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const rows = await q(supabase.from('coupons').select('*').order('redeemed').order('created_at'));
      box.replaceChildren(rows.length
        ? h('div', { class: 'coupons' }, rows.map((c) => ticket(c, load)))
        : empty('No coupons yet. Make the first one!', '+ Add a coupon', () => openForm(null, load)));
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load coupons.', 'Try again', load));
    }
  }
  await load();
}

function stamp(c, fresh = false) {
  return h('div', { class: `stamp${fresh ? ' fresh' : ''}`, 'aria-hidden': 'true' }, 'REDEEMED', h('small', {}, formatDateTime(c.redeemed_at)));
}

function ticket(c, reload) {
  const side = h('div', { class: 'side' });
  const el = h('article', { class: `ticket${c.redeemed ? ' redeemed' : ''}` },
    h('div', {},
      h('div', { class: 'kicker' }, 'Coupon'),
      h('h3', {}, c.title),
      c.description ? h('p', { class: 'pre muted', style: { margin: 0 } }, c.description) : null,
      h('div', { class: 'row', style: { marginTop: '.4rem' } }, authorBadge(c.created_by)),
    ),
    side,
    c.redeemed ? stamp(c) : null,
  );
  if (c.redeemed) {
    side.append(h('span', { class: 'sr-only' }, `Redeemed ${formatDateTime(c.redeemed_at)}`));
  } else {
    side.append(h('button', {
      class: 'btn small', type: 'button', text: 'Redeem',
      onclick: async () => {
        if (!(await confirmDialog(`Redeem “${c.title}”?`, { ok: 'Redeem it!', title: 'Ready to cash it in?' }))) return;
        try {
          const row = await db.patch('coupons', c.id, { redeemed: true, redeemed_at: new Date().toISOString() });
          el.classList.add('redeemed');
          side.replaceChildren(iconBtn(`Edit “${c.title}”`, '✎', () => openForm(row, reload)));
          el.append(stamp(row, true));
          celebrateAt(el);
          toast('Redeemed! Enjoy. 🎟️');
        } catch (err) { toastError(err); }
      },
    }));
  }
  side.append(iconBtn(`Edit “${c.title}”`, '✎', () => openForm(c, reload)));
  return el;
}

function openForm(c, reload) {
  editSheet({
    title: c ? 'Edit coupon' : 'New coupon',
    initial: c || {},
    fields: [
      { name: 'title', label: 'Good for…', required: true, max: 100, placeholder: 'One long back rub' },
      { name: 'description', label: 'Fine print', type: 'textarea', rows: 3, max: 400 },
      ...(c ? [{ name: 'redeemed', label: 'Already redeemed', type: 'checkbox' }] : []),
    ],
    onDelete: c ? async () => { await db.remove('coupons', c.id); toast('Coupon removed.'); reload(); } : null,
    onSave: async (v) => {
      if (c) {
        const redeemed = !!v.redeemed;
        await db.update('coupons', c.id, {
          title: v.title, description: v.description, redeemed,
          redeemed_at: redeemed ? (c.redeemed_at || new Date().toISOString()) : null,
        });
      } else {
        await db.insert('coupons', { title: v.title, description: v.description });
      }
      toast('Saved.');
      reload();
    },
  });
}
