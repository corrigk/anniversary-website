// Timed surprises: little notes that unlock at a moment the author chose.
import { h, pageHead, empty, loading, editSheet, iconBtn, toast, toastError } from '../ui.js';
import { supabase, q, isMissingFeature } from '../supabase.js';
import { db, state, nameOf, authorBadge } from '../data.js';
import { celebrateAt } from '../magic.js';

const other = () => [...state.profiles.values()].find((p) => p.id !== state.user.id)?.display_name || 'them';

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Little surprises', 'Notes that arrive right on time.', () => openForm(null, load), '+ Add'), box);
  let ticker = null;

  async function load() {
    clearInterval(ticker);
    box.replaceChildren(loading('Checking the mailbox…'));
    let rows, waiting;
    try {
      [rows, waiting] = await Promise.all([
        q(supabase.from('surprises').select('*').order('unlock_at', { ascending: false })),
        supabase.rpc('surprises_waiting').then((r) => (r.error ? null : r.data)),
      ]);
    } catch (err) {
      const off = isMissingFeature(err);
      if (!off) toastError(err);
      box.replaceChildren(empty(off ? 'Surprises aren’t switched on yet. (Bubs: run supabase/extras.sql.)' : 'Couldn’t check for surprises.', off ? null : 'Try again', load));
      return;
    }
    const now = Date.now();
    const open = rows.filter((r) => new Date(r.unlock_at).getTime() <= now);
    const scheduled = rows.filter((r) => new Date(r.unlock_at).getTime() > now).reverse(); // mine only (RLS hides the rest)
    const parts = [];

    // What's still on its way to me
    if (waiting?.locked > 0) {
      const clock = h('b', { class: 'when' });
      const card = h('section', { class: 'card center waiting-card' },
        h('div', { class: 'gift', 'aria-hidden': 'true' }, '🎁'),
        h('p', { style: { margin: 0, fontWeight: 700 } }, waiting.locked === 1 ? 'One more surprise is on its way' : `${waiting.locked} more surprises are on their way`),
        h('p', { class: 'muted', style: { margin: '.2rem 0 0' } }, 'The next one arrives in ', clock));
      let left = Math.max(0, waiting.seconds_remaining || 0);
      const tick = () => {
        if (left <= 0) { clearInterval(ticker); setTimeout(load, 1200); clock.textContent = 'a moment…'; return; }
        const d = Math.floor(left / 86400), hh = Math.floor((left % 86400) / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
        clock.textContent = d > 0 ? `${d}d ${hh}h ${mm}m` : `${hh ? `${hh}:` : ''}${String(mm).padStart(hh ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
        left--;
      };
      tick();
      ticker = setInterval(tick, 1000);
      parts.push(card);
    }

    // What has arrived
    const fresh = [];
    for (const r of open) {
      const isNew = !r.seen_at && r.created_by !== state.user.id;
      const el = note(r, isNew, load);
      if (isNew) fresh.push([r, el]);
      parts.push(el);
    }
    if (!open.length && !(waiting?.locked > 0)) {
      parts.push(empty(scheduled.length ? 'Nothing has arrived yet. Yours are scheduled below.' : 'No surprises yet. Schedule the first one!', '+ Schedule a surprise', () => openForm(null, load)));
    }

    // What I've scheduled for the other person
    if (scheduled.length) {
      parts.push(
        h('h2', { style: { marginTop: '1.5rem' } }, 'Scheduled by you'),
        h('p', { class: 'muted small' }, `${other()} can’t see these until their time comes.`),
        h('section', { class: 'card' }, h('ul', { class: 'list' }, scheduled.map((r) => h('li', { class: 'item' },
          h('span', { style: { fontSize: '1.5rem', width: '2.2rem', textAlign: 'center' }, 'aria-hidden': 'true' }, r.emoji || '💌'),
          h('div', { class: 'grow' }, h('b', {}, r.title), h('div', { class: 'muted small' }, `Unlocks ${fmt(r.unlock_at)}`)),
          iconBtn(`Edit “${r.title}”`, '✎', () => openForm(r, load)),
        )))),
      );
    }
    box.replaceChildren(...parts);

    // Mark newly arrived notes as seen, with a little fanfare for the first.
    if (fresh.length) {
      setTimeout(() => celebrateAt(fresh[0][1], { n: 36 }), 350);
      supabase.from('surprises').update({ seen_at: new Date().toISOString() }).in('id', fresh.map(([r]) => r.id)).then(() => {});
    }
  }

  const onArrive = () => load();
  window.addEventListener('bh:surprise', onArrive);
  await load();
  return () => { clearInterval(ticker); window.removeEventListener('bh:surprise', onArrive); };
}

const fmt = (ts) => new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function note(r, isNew, reload) {
  const from = nameOf(r.created_by);
  return h('article', { class: `card surprise${isNew ? ' new' : ''}` },
    h('div', { class: 'surprise-head' },
      h('span', { class: 'emo', 'aria-hidden': 'true' }, r.emoji || '💌'),
      h('div', { class: 'grow' },
        h('h3', { style: { margin: 0 } }, r.title),
        h('div', { class: 'muted small' }, `${from ? `From ${from} · ` : ''}arrived ${fmt(r.unlock_at)}`)),
      isNew ? h('span', { class: 'chip new-chip' }, 'New') : null,
      r.created_by === state.user.id ? iconBtn(`Edit “${r.title}”`, '✎', () => openForm(r, reload)) : null,
    ),
    r.body ? h('p', { class: 'pre surprise-body' }, r.body) : null,
    r.created_by === state.user.id ? authorBadge(r.created_by) : null,
  );
}

// <input type="datetime-local"> value for a timestamp, in the phone's own time zone.
function toLocalInput(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openForm(r, reload) {
  const soon = new Date(Date.now() + 3600 * 1000);
  soon.setMinutes(0, 0, 0);
  editSheet({
    title: r ? 'Edit surprise' : 'Schedule a surprise',
    initial: r ? { ...r, unlock_at: toLocalInput(r.unlock_at) } : { emoji: '💌', unlock_at: toLocalInput(soon) },
    saveText: r ? 'Save' : 'Schedule it',
    fields: [
      { name: 'title', label: 'Title', required: true, max: 100, placeholder: 'Thinking of you…' },
      { name: 'body', label: 'Your note', type: 'textarea', rows: 6 },
      { name: 'unlock_at', label: 'Unlocks at', type: 'datetime-local', required: true, hint: `Your local time. ${other()} can’t read it before then.` },
      { name: 'emoji', label: 'Emoji', max: 8, placeholder: '💌' },
    ],
    onDelete: r ? async () => { await db.remove('surprises', r.id); toast('Surprise removed.'); reload(); } : null,
    onSave: async (v) => {
      const when = new Date(v.unlock_at);
      if (Number.isNaN(when.getTime())) throw new Error('Pick a date and time for it to unlock.');
      const row = { title: v.title, body: v.body, emoji: v.emoji, unlock_at: when.toISOString() };
      if (r) await db.update('surprises', r.id, row); else await db.insert('surprises', row);
      toast(when.getTime() > Date.now() ? `Scheduled for ${fmt(when)} 💝` : 'Saved. It’s visible right away.');
      reload();
    },
  });
}
