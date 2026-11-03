// Puzzles: prompts live in the DB, answers are checked by the check_puzzle()
// RPC and never reach the browser.
import { h, pageHead, empty, loading, openSheet, editSheet, toast, toastError, sprig, petals, uuid } from '../ui.js';
import { supabase, q, friendlyError } from '../supabase.js';
import { db, state } from '../data.js';
import { signedUrl, upload, removeFiles } from '../storage.js';
import { processPhoto } from '../image.js';
import { celebrateAt } from '../magic.js';

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Puzzle garden', 'A few gentle riddles. Hints are free!', () => openForm(null, load), '+ Add'), box);

  async function load() {
    box.replaceChildren(loading());
    try {
      const [puzzles, progress] = await Promise.all([
        q(supabase.from('puzzles').select('*').order('position').order('created_at')),
        q(supabase.from('puzzle_progress').select('puzzle_id').eq('user_id', state.user.id)),
      ]);
      const solved = new Set(progress.map((p) => p.puzzle_id));
      if (!puzzles.length) {
        box.replaceChildren(empty('No puzzles yet.', '+ Add a puzzle', () => openForm(null, load)));
        return;
      }
      let unlocked = true;
      const stones = puzzles.map((p, i) => {
        const isSolved = solved.has(p.id);
        const open = unlocked;
        if (!isSolved) unlocked = false; // the next one waits until this is solved
        return h('button', {
          class: `stone${isSolved ? ' solved' : ''}${open ? '' : ' locked'}`, type: 'button',
          'aria-disabled': String(!open),
          'aria-label': `${i + 1}. ${p.title}${isSolved ? ' (solved)' : open ? '' : ' (locked)'}`,
          onclick: () => open ? openPuzzle(p, isSolved, load) : toast('Solve the one before it first. 🌱'),
        },
          h('span', { class: 'n', 'aria-hidden': 'true' }, isSolved ? '✓' : open ? String(i + 1) : '🔒'),
          h('span', {}, h('b', {}, p.title), h('span', { class: 'muted small' }, isSolved ? 'Solved!' : open ? 'Tap to play' : 'Not yet')),
        );
      });
      const doneAll = puzzles.every((p) => solved.has(p.id));
      box.replaceChildren(
        h('div', { class: 'path' }, stones),
        doneAll ? h('p', { class: 'center' }, sprig(), ' You solved them all! ') : '',
      );
    } catch (err) {
      toastError(err);
      box.replaceChildren(empty('Couldn’t load puzzles.', 'Try again', load));
    }
  }
  await load();
}

function openPuzzle(p, alreadySolved, reload) {
  const img = p.image_path ? h('img', { class: 'puzzle-img', alt: `Picture for “${p.title}”` }) : null;
  if (img) signedUrl(p.image_path).then((u) => { if (u) img.src = u; }).catch(toastError);

  const answer = h('input', { id: 'puzzle-answer', type: p.input_type === 'date' ? 'date' : 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  const msg = h('p', { class: 'form-error', role: 'status' });
  const check = h('button', { class: 'btn', type: 'submit', text: 'Check' });
  const hint = h('p', { class: 'muted', hidden: true }, '💡 ', p.hint || 'No hint for this one, sorry!');
  const hintBtn = h('button', { class: 'btn soft small', type: 'button', text: 'Need a hint?', onclick: () => { hint.hidden = false; hintBtn.hidden = true; } });
  const reward = h('div', { class: 'reward', hidden: !alreadySolved },
    sprig(), h('h3', {}, 'You got it!'), h('p', { class: 'pre', style: { margin: 0 } }, p.reward_text || '♡'));

  const form = h('form', { hidden: alreadySolved },
    h('label', { class: 'field', for: 'puzzle-answer' }, h('span', {}, 'Your answer'), answer),
    msg,
    h('div', { class: 'row' }, check, h('span', { class: 'spacer' }), hintBtn),
    hint,
  );
  const edit = h('button', { class: 'btn ghost small', type: 'button', text: 'Edit puzzle' });
  const s = openSheet({
    title: p.title,
    body: h('div', {}, p.prompt ? h('p', { class: 'puzzle-prompt' }, p.prompt) : null, img, form, reward),
    footer: [h('span', { class: 'spacer' }), edit],
    onClose: (r) => { if (r === 'solved' || solvedNow) reload(); },
  });
  let solvedNow = false;
  edit.addEventListener('click', () => { s.close(); openForm(p, reload); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const guess = answer.value.trim();
    if (!guess) { msg.textContent = 'Type a guess first!'; return; }
    check.disabled = true;
    msg.textContent = '';
    const { data, error } = await supabase.rpc('check_puzzle', { p_puzzle_id: p.id, p_guess: guess });
    check.disabled = false;
    if (error) { msg.textContent = friendlyError(error); return; }
    if (data === true) {
      solvedNow = true;
      form.hidden = true;
      reward.hidden = false;
      s.sheet.append(petals(16));
      celebrateAt(reward, { n: 60 });
    } else {
      msg.textContent = 'Not quite — try again 💛';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    }
  });
}

function openForm(p, reload) {
  let image = null;
  let dropImage = false;
  const status = h('span', { class: 'hint' }, p?.image_path ? 'A picture is attached.' : 'Optional, for “what’s in this photo?” puzzles.');
  const input = h('input', { type: 'file', accept: 'image/*', id: 'puzzle-image' });
  const clear = h('button', { class: 'btn ghost small', type: 'button', text: 'Remove picture', hidden: !p?.image_path });
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    status.textContent = 'Preparing…';
    try { image = await processPhoto(f); status.textContent = 'Picture ready.'; dropImage = false; }
    catch (err) { image = null; input.value = ''; status.textContent = ''; toastError(err); }
  });
  clear.addEventListener('click', () => { dropImage = true; image = null; input.value = ''; clear.hidden = true; status.textContent = 'Picture will be removed when you save.'; });

  editSheet({
    title: p ? 'Edit puzzle' : 'New puzzle',
    initial: p || { input_type: 'text', position: 99 },
    fields: [
      { name: 'title', label: 'Title', required: true, max: 80 },
      { name: 'prompt', label: 'Prompt', type: 'textarea', rows: 4, hint: 'Riddles, ciphers, scrambles: write it exactly as it should appear.' },
      { name: 'input_type', label: 'Answer box', type: 'select', options: [{ value: 'text', label: 'Text' }, { value: 'date', label: 'Date picker (date lock)' }] },
      { name: 'hint', label: 'Hint', type: 'textarea', rows: 2 },
      { name: 'reward_text', label: 'Reward message', type: 'textarea', rows: 3 },
      { name: 'position', label: 'Order', type: 'number', inputmode: 'numeric', hint: 'Lower numbers come first.' },
    ],
    extra: h('div', { class: 'field' },
      h('label', { for: 'puzzle-image' }, h('span', {}, 'Picture')), input, status, clear,
      h('p', { class: 'hint', style: { marginTop: '.8rem' } },
        '🔐 Answers are set in the Supabase SQL editor so they never appear in the site’s code (see README → Puzzles).')),
    onDelete: p ? async () => {
      if (p.image_path) await removeFiles([p.image_path]).catch(toastError);
      await db.remove('puzzles', p.id);
      toast('Puzzle removed.');
      reload();
    } : null,
    onSave: async (v, { progress }) => {
      const row = { ...v, position: Number.parseInt(v.position, 10) || 0, input_type: v.input_type || 'text' };
      const saved = p ? await db.update('puzzles', p.id, row) : await db.insert('puzzles', row);
      if ((dropImage || image) && p?.image_path) {
        await removeFiles([p.image_path]).catch(toastError);
        await db.patch('puzzles', saved.id, { image_path: null });
      }
      if (image) {
        progress('Uploading picture…');
        const path = `puzzles/${saved.id}/${uuid()}.jpg`;
        await upload(path, image.full, 'image/jpeg');
        await db.patch('puzzles', saved.id, { image_path: path });
      }
      toast(p ? 'Puzzle saved.' : 'Puzzle added. Remember to set its answer in Supabase!', 'info', 5000);
      reload();
    },
  });
}
