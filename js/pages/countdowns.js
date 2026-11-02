import { h, pageHead, empty, loading, editSheet, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, startDate, authorBadge } from '../data.js';
import { today, daysBetween, nextAnniversary, ordinal, parseDate, formatDate, relativeDays, toISO, plural } from '../dates.js';

export async function render(root) {
  const box = h('div', { style: { marginTop: '1rem' } });
  root.append(pageHead('Countdowns', 'Things to look forward to (and look back on).', () => openForm(null, load), '+ Add'));

  const start = startDate();
  if (start) {
    const ann = nextAnniversary(start);
    root.append(h('section', { class: 'card cd' },
      h('span', { class: 'emo', 'aria-hidden': 'true' }, '💐'),
      h('div', { class: 'grow' },
        h('b', {}, `Our ${ordinal(ann.number)} anniversary`),
        h('div', { class: 'muted small' }, formatDate(toISO(ann.date), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
      ),
      h('div', { class: 'when' }, ann.daysAway === 0 ? 'Today! ♡' : plural(ann.daysAway, 'day')),
    ));
  }
  root.append(box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const rows = await q(supabase.from('countdowns').select('*').order('event_date'));
      const now = today();
      const upcoming = rows.filter((r) => daysBetween(now, parseDate(r.event_date)) >= 0);
      const past = rows.filter((r) => daysBetween(now, parseDate(r.event_date)) < 0).reverse();
      if (!rows.length) {
        box.replaceChildren(empty('No other countdowns yet. Add something to look forward to!', '+ Add a countdown', () => openForm(null, load)));
        return;
      }
      box.replaceChildren(
        ...upcoming.map((r) => row(r, false, load)),
        past.length ? h('h2', { style: { marginTop: '1.5rem' } }, 'Looking back') : '',
        ...past.map((r) => row(r, true, load)),
      );
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load countdowns.', 'Try again', load));
    }
  }
  await load();
}

function row(r, past, reload) {
  return h('article', { class: `card cd${past ? ' past' : ''}` },
    h('span', { class: 'emo', 'aria-hidden': 'true' }, r.emoji || '📅'),
    h('div', { class: 'grow' },
      h('b', {}, r.title),
      h('div', { class: 'muted small' }, formatDate(r.event_date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })),
      authorBadge(r.created_by),
    ),
    h('div', { class: 'when' }, relativeDays(r.event_date)),
    iconBtn(`Edit “${r.title}”`, '✎', () => openForm(r, reload)),
  );
}

function openForm(r, reload) {
  editSheet({
    title: r ? 'Edit countdown' : 'New countdown',
    initial: r || { emoji: '✨' },
    fields: [
      { name: 'title', label: 'What’s happening?', required: true, max: 100 },
      { name: 'event_date', label: 'Date', type: 'date', required: true },
      { name: 'emoji', label: 'Emoji', max: 8, placeholder: '✨' },
    ],
    onDelete: r ? async () => { await db.remove('countdowns', r.id); toast('Countdown removed.'); reload(); } : null,
    onSave: async (v) => {
      if (r) await db.update('countdowns', r.id, v); else await db.insert('countdowns', v);
      toast('Saved.');
      reload();
    },
  });
}
