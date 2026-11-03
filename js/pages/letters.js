import { h, pageHead, empty, loading, editSheet, openSheet, toast, toastError, divider, uuid } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, state, authorBadge, nameOf } from '../data.js';
import { signedUrl, upload, removeFiles } from '../storage.js';
import { formatDateTime } from '../dates.js';
import { celebrateAt } from '../magic.js';

export async function render(root) {
  const box = h('div');
  root.append(
    pageHead('Open when…', 'Little letters for the moments you need them.', () => openForm(null, load), '+ Write'),
    box,
  );

  async function load() {
    box.replaceChildren(loading('Fetching the mail…'));
    try {
      const rows = await q(supabase.from('letters').select('*').order('created_at', { ascending: true }));
      box.replaceChildren(rows.length
        ? h('div', { class: 'envelopes' }, rows.map((l) => envelope(l, load)))
        : empty('No letters yet. Write the first one!', '+ Write a letter', () => openForm(null, load)));
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load letters.', 'Try again', load));
    }
  }
  await load();
}

function envelope(l, reload) {
  const opened = !!l.opened_at;
  const label = l.label.replace(/^open when\s*/i, '');
  return h('button', {
    class: `envelope${opened ? ' opened' : ''}`, type: 'button',
    'aria-label': `${l.label}${opened ? ' (opened)' : ''}`,
    onclick: (e) => openLetter(l, e.currentTarget, reload),
  },
    h('span', { class: 'flap', 'aria-hidden': 'true' }),
    h('span', { class: 'seal', 'aria-hidden': 'true' }),
    opened ? h('span', { class: 'state', 'aria-hidden': 'true' }, 'opened') : null,
    h('span', { class: 'lbl' }, h('span', { class: 'muted', style: { fontWeight: 600 } }, 'Open when '), label),
  );
}

async function openLetter(l, envEl, reload) {
  // Mark as opened the first time someone OTHER than the author opens it,
  // so the writer previewing their own letter doesn't spoil it.
  if (!l.opened_at && l.created_by !== state.user.id) {
    envEl.classList.add('opened');
    db.patch('letters', l.id, { opened_at: new Date().toISOString() })
      .then((row) => { l.opened_at = row.opened_at; })
      .catch(toastError);
  }
  envEl.classList.add('opening');
  celebrateAt(envEl.querySelector('.seal'), { n: 22, haptic: true });
  await new Promise((r) => setTimeout(r, 420)); // let the flap animation play
  envEl.classList.remove('opening');

  const audio = l.audio_path ? h('audio', { controls: true, preload: 'none' }) : null;
  if (audio) signedUrl(l.audio_path).then((u) => { if (u) audio.src = u; }).catch(toastError);
  const author = nameOf(l.created_by);

  const edit = h('button', { class: 'btn ghost small', type: 'button', text: 'Edit' });
  const s = openSheet({
    title: l.label,
    body: h('div', {},
      h('div', { class: 'letter-paper' },
        h('div', { class: 'body' }, l.body || '(This letter is still blank.)'),
        audio,
        author ? h('p', { class: 'muted', style: { marginTop: '1rem', fontStyle: 'italic', textAlign: 'right' } }, `— ${author}`) : null,
      ),
      divider(true),
      l.opened_at ? h('p', { class: 'muted small center' }, `First opened ${formatDateTime(l.opened_at)}`) : null,
    ),
    footer: [authorBadge(l.created_by), h('span', { class: 'spacer' }), edit],
  });
  edit.addEventListener('click', () => { s.close(); openForm(l, reload); });
}

function openForm(l, reload) {
  let audioFile = null;
  let removeAudio = false;
  const status = h('span', { class: 'hint' }, l?.audio_path ? 'A voice memo is attached.' : 'Optional: attach a voice memo (m4a, mp3…).');
  const input = h('input', { type: 'file', accept: 'audio/*', id: 'letter-audio' });
  const clear = h('button', { class: 'btn ghost small', type: 'button', text: 'Remove voice memo', hidden: !l?.audio_path });
  input.addEventListener('change', () => {
    audioFile = input.files[0] || null;
    if (audioFile && audioFile.size > 25 * 1024 * 1024) { toast('That recording is over 25 MB. Try a shorter one.', 'error'); audioFile = null; input.value = ''; return; }
    status.textContent = audioFile ? `Will attach “${audioFile.name}”.` : '';
    removeAudio = false;
  });
  clear.addEventListener('click', () => { removeAudio = true; audioFile = null; input.value = ''; clear.hidden = true; status.textContent = 'Voice memo will be removed when you save.'; });
  const audioField = h('div', { class: 'field' }, h('label', { for: 'letter-audio' }, h('span', {}, 'Voice memo')), input, status, clear);

  editSheet({
    title: l ? 'Edit letter' : 'New letter',
    initial: l || { label: 'Open when you ' },
    fields: [
      { name: 'label', label: 'Label', required: true, max: 120, hint: 'e.g. “Open when you miss me”' },
      { name: 'body', label: 'Letter', type: 'textarea', rows: 10 },
    ],
    extra: audioField,
    onDelete: l ? async () => {
      if (l.audio_path) await removeFiles([l.audio_path]).catch(toastError);
      await db.remove('letters', l.id);
      toast('Letter deleted.');
      reload();
    } : null,
    onSave: async (v, { progress }) => {
      const row = l ? await db.update('letters', l.id, v) : await db.insert('letters', v);
      if ((removeAudio || audioFile) && l?.audio_path) {
        await removeFiles([l.audio_path]).catch(toastError);
        await db.patch('letters', row.id, { audio_path: null });
      }
      if (audioFile) {
        progress('Uploading voice memo…');
        const ext = (audioFile.name.split('.').pop() || 'm4a').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `letters/${row.id}/${uuid()}.${ext}`;
        await upload(path, audioFile, audioFile.type || 'audio/mp4');
        await db.patch('letters', row.id, { audio_path: path });
      }
      toast(l ? 'Letter saved.' : 'Letter sealed! 💌');
      reload();
    },
  });
}
