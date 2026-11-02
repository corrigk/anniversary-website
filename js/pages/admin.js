// Hidden page (#/admin, not linked anywhere): placeholder cleanup and resets.
import { h, pageHead, loading, confirmDialog, toast, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, state } from '../data.js';
import { removeFiles } from '../storage.js';
import { signOut } from '../app.js';

const TABLES = [
  ['memories', 'Timeline memories'], ['letters', 'Letters'], ['reasons', 'Reasons'], ['coupons', 'Coupons'],
  ['bucket_items', 'Bucket list'], ['songs', 'Songs'], ['countdowns', 'Countdowns'], ['puzzles', 'Puzzles'],
];

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Admin', 'Behind the scenes. Not linked from anywhere.'), box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const counts = await Promise.all(TABLES.map(([t]) => db.count(t, (x) => x.eq('is_placeholder', true))));
      const total = counts.reduce((a, b) => a + b, 0);
      box.replaceChildren(
        h('section', { class: 'card' },
          h('h2', {}, 'Placeholder content'),
          h('p', { class: 'muted small' }, 'Draft rows from seed_placeholders.sql. Anything edited in the app is no longer a placeholder and is kept.'),
          h('ul', { class: 'list' }, TABLES.map(([t, label], i) => h('li', { class: 'item' },
            h('div', { class: 'grow' }, label, h('div', { class: 'muted small' }, `${counts[i]} placeholder${counts[i] === 1 ? '' : 's'}`)),
            h('button', { class: 'btn danger small', type: 'button', disabled: !counts[i], text: 'Remove', onclick: () => clear([t, label]) }),
          ))),
          h('button', { class: 'btn danger block', type: 'button', disabled: !total, style: { marginTop: '1rem' }, text: `Remove all ${total} placeholders`, onclick: () => clear(null) }),
        ),
        h('section', { class: 'card' },
          h('h2', {}, 'Resets'),
          h('div', { class: 'stack' },
            h('button', { class: 'btn ghost block', type: 'button', text: 'Mark every letter unopened', onclick: resetLetters }),
            h('button', { class: 'btn ghost block', type: 'button', text: 'Reset MY puzzle progress', onclick: resetPuzzles }),
          ),
        ),
        h('section', { class: 'card' },
          h('h2', {}, 'Settings'),
          h('p', { class: 'muted small' }, 'Read-only here. Change them in the Supabase SQL editor (see README).'),
          h('ul', { class: 'list' }, Object.entries(state.settings).map(([k, v]) => h('li', { class: 'item' },
            h('div', { class: 'grow' }, h('b', {}, k), h('div', { class: 'muted small' }, JSON.stringify(v)))))),
          h('button', { class: 'btn ghost block', type: 'button', style: { marginTop: '1rem' }, text: 'Sign out', onclick: signOut }),
        ),
      );
    } catch (err) {
      toastError(err);
      box.replaceChildren(h('p', {}, 'Couldn’t load admin data.'));
    }
  }

  async function clear(only) {
    const list = only ? [only] : TABLES;
    const what = only ? only[1].toLowerCase() : 'every section';
    if (!(await confirmDialog(`Delete the placeholder content in ${what}? Real content is kept.`, { ok: 'Delete placeholders', danger: true }))) return;
    try {
      for (const [t] of list) {
        if (t === 'memories') {
          const photos = await q(supabase.from('memory_photos').select('storage_path, thumb_path, memories!inner(is_placeholder)').eq('memories.is_placeholder', true));
          await removeFiles(photos.flatMap((p) => [p.storage_path, p.thumb_path]));
        }
        if (t === 'letters') {
          const rows = await q(supabase.from('letters').select('audio_path').eq('is_placeholder', true).not('audio_path', 'is', null));
          await removeFiles(rows.map((r) => r.audio_path));
        }
        if (t === 'puzzles') {
          const rows = await q(supabase.from('puzzles').select('image_path').eq('is_placeholder', true).not('image_path', 'is', null));
          await removeFiles(rows.map((r) => r.image_path));
        }
        await q(supabase.from(t).delete().eq('is_placeholder', true));
      }
      toast('Placeholders removed.');
    } catch (err) { toastError(err); }
    load();
  }

  async function resetLetters() {
    if (!(await confirmDialog('Every envelope will look sealed again.', { ok: 'Reset' }))) return;
    try { await q(supabase.from('letters').update({ opened_at: null }).not('opened_at', 'is', null)); toast('All letters are sealed again.'); }
    catch (err) { toastError(err); }
  }
  async function resetPuzzles() {
    if (!(await confirmDialog('Your solved puzzles will be unsolved again.', { ok: 'Reset' }))) return;
    try { await q(supabase.from('puzzle_progress').delete().eq('user_id', state.user.id)); toast('Your puzzle progress was reset.'); }
    catch (err) { toastError(err); }
  }

  await load();
}
