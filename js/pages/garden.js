// The secret garden: every memory is a flower. They start as buds; tap one
// and it blooms, then opens its memory. Hidden until settings.garden_unlock_on
// (add ?peek=1 to the address to preview it before then).
import { h, s, pageHead, empty, loading, toastError, seeded, sprig } from '../ui.js';
import { state, gardenUnlocked } from '../data.js';
import { loadMemories, openMemory } from '../memories.js';
import { formatDate } from '../dates.js';
import { celebrate, celebrateAt } from '../magic.js';
import { chime } from '../sound.js';

const key = () => `bh-garden-${state.user?.id}`;
function loadBloomed() {
  try { return new Set(JSON.parse(localStorage.getItem(key()) || '[]')); } catch { return new Set(); }
}
function saveBloomed(set) {
  try { localStorage.setItem(key(), JSON.stringify([...set])); } catch { /* private mode */ }
}

export async function render(root, { params } = {}) {
  if (!gardenUnlocked() && params?.get('peek') !== '1') {
    root.append(h('div', { class: 'empty', style: { marginTop: '2rem' } },
      h('div', { style: { fontSize: '2.4rem' }, 'aria-hidden': 'true' }, '🌙'),
      h('h2', {}, 'The garden gate is closed'),
      h('p', {}, 'Something is still growing in here. Come back on a very special day.')));
    return;
  }

  const box = h('div');
  root.append(pageHead('The secret garden', 'Every memory is a flower. Tap a bud to help it bloom.'), box);
  box.append(loading('Unlatching the gate…'));

  let rows;
  try { rows = await loadMemories(); }
  catch (err) { toastError(err); box.replaceChildren(empty('Couldn’t open the garden.')); return; }
  if (!rows.length) { box.replaceChildren(empty('Nothing is planted yet. Add memories to the timeline and they’ll grow here.')); return; }

  const bloomed = loadBloomed();
  // Forget flowers for memories that no longer exist.
  const ids = new Set(rows.map((m) => m.id));
  [...bloomed].forEach((id) => { if (!ids.has(id)) bloomed.delete(id); });

  const bar = h('i');
  const label = h('p', { class: 'muted small', style: { margin: '.4rem 0 0' }, 'aria-live': 'polite' });
  const finale = h('section', { class: 'card center garden-finale', hidden: true },
    sprig(), h('h2', {}, 'The whole garden is in bloom'),
    h('p', { class: 'pre' }, state.settings.garden_message || 'Every one of these grew because of you.'));
  const progress = h('section', { class: 'card' }, h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Flowers in bloom', 'aria-valuemin': '0', 'aria-valuemax': String(rows.length) }, bar), label);

  function sync(first = false) {
    const n = bloomed.size;
    bar.style.width = `${(n / rows.length) * 100}%`;
    bar.parentElement.setAttribute('aria-valuenow', String(n));
    label.textContent = n === rows.length ? `All ${n} flowers are in bloom 🌸` : `${n} of ${rows.length} in bloom`;
    if (n !== rows.length || !finale.hidden) return;
    if (first) { finale.hidden = false; return; }
    // The last flower just bloomed: wait until its memory is closed, then celebrate.
    const reveal = () => {
      if (document.querySelector('.sheet-backdrop')) { setTimeout(reveal, 400); return; }
      if (!document.contains(finale)) return;
      finale.hidden = false;
      celebrate(undefined, undefined, { n: 90 });
      finale.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    setTimeout(reveal, 900);
  }

  const beds = [];
  let year = null, bed = null;
  rows.forEach((m, i) => {
    const y = m.happened_on.slice(0, 4);
    if (y !== year) {
      year = y;
      bed = h('div', { class: 'bed' });
      beds.push(h('section', { class: 'bed-wrap', 'aria-label': `Flowers from ${y}` }, h('h2', { class: 'bed-year' }, sprig(), y), bed));
    }
    bed.append(flowerButton(m, i, bloomed, sync));
  });

  box.replaceChildren(progress, finale, ...beds);
  sync(true);
}

function flowerButton(m, i, bloomed, sync) {
  const open = bloomed.has(m.id);
  const btn = h('button', {
    class: `flower fc${Math.floor(seeded(m.id, 7) * 5)}${open ? ' open' : ''}`, type: 'button',
    'aria-label': `${open ? '' : 'A bud: '}${m.title}, ${formatDate(m.happened_on)}`,
  }, flowerSvg(m), h('span', { class: 'flower-date' }, formatDate(m.happened_on, { month: 'short', day: 'numeric' })));

  btn.addEventListener('click', async () => {
    if (btn.dataset.busy) return;
    if (!btn.classList.contains('open')) {
      btn.dataset.busy = '1';
      btn.classList.add('open');
      bloomed.add(m.id);
      saveBloomed(bloomed);
      sync();
      celebrateAt(btn.querySelector('.bloom-at') || btn, { n: 16, haptic: true });
      chime('bloom');
      btn.setAttribute('aria-label', `${m.title}, ${formatDate(m.happened_on)}`);
      await new Promise((r) => setTimeout(r, 850)); // let it bloom before the memory opens
      delete btn.dataset.busy;
      if (document.contains(btn)) openMemory(m, { kicker: 'A memory in bloom' });
      return;
    }
    openMemory(m);
  });
  return btn;
}

// One flower: a stem with two leaves, a bud, and a bloom that opens over it.
function flowerSvg(m) {
  const r = (n) => seeded(m.id, n);
  const stem = 40 + r(1) * 36;
  const topY = 106 - stem;
  const lean = (r(2) - 0.5) * 12;
  const cx = 30 + lean * 0.6;
  const midY = (106 + topY) / 2;
  const svg = s('svg', {
    class: 'flower-svg', viewBox: '0 0 60 112', 'aria-hidden': 'true',
    style: `--d:${(-r(3) * 5).toFixed(2)}s; --t:${(4 + r(4) * 3).toFixed(2)}s`,
  });
  svg.append(
    s('path', { class: 'stem', d: `M30 110 Q ${30 + lean} ${midY} ${cx} ${topY}` }),
    s('path', { class: 'leafy', d: `M${30 + lean * 0.35} ${midY + 8} q -13 -3 -15 -14 q 12 0 15 14 z` }),
    s('path', { class: 'leafy', d: `M${30 + lean * 0.45} ${midY - 2} q 13 -3 15 -14 q -12 0 -15 14 z` }),
    s('ellipse', { class: 'bud', cx, cy: topY - 2, rx: 4.6, ry: 7.5 }),
  );
  const bloom = s('g', { class: 'bloom' });
  const kind = Math.floor(r(5) * 5);
  if (kind === 0) { // daisy
    for (let k = 0; k < 9; k++) bloom.append(s('ellipse', { class: 'petal', cx: 0, cy: -9, rx: 3.4, ry: 8, transform: `rotate(${k * 40})` }));
    bloom.append(s('circle', { class: 'heart', r: 4.6 }));
  } else if (kind === 1) { // blossom
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; bloom.append(s('circle', { class: 'petal', cx: Math.cos(a) * 7.5, cy: Math.sin(a) * 7.5, r: 6.3 })); }
    bloom.append(s('circle', { class: 'heart', r: 3.7 }));
  } else if (kind === 2) { // tulip
    bloom.append(
      s('path', { class: 'petal', d: 'M-10 -3 C-10 -17 -3 -15 0 -8 C3 -15 10 -17 10 -3 C10 7 5 10 0 10 C-5 10 -10 7 -10 -3 Z' }),
      s('path', { class: 'petal shade', d: 'M0 -9 C4 -4 4 5 0 10 C-4 5 -4 -4 0 -9 Z' }),
    );
  } else if (kind === 3) { // rose
    bloom.append(s('circle', { class: 'petal', r: 11.5 }), s('circle', { class: 'petal shade', r: 7.8 }), s('circle', { class: 'petal', r: 4.4 }), s('circle', { class: 'petal shade', r: 1.8 }));
  } else { // star flower
    for (let k = 0; k < 6; k++) bloom.append(s('path', { class: 'petal', d: 'M0 0 Q-5 -8 0 -15 Q5 -8 0 0 Z', transform: `rotate(${k * 60})` }));
    bloom.append(s('circle', { class: 'heart', r: 3.2 }));
  }
  svg.append(s('g', { class: 'bloom-at', transform: `translate(${cx} ${topY})` }, bloom));
  return svg;
}
