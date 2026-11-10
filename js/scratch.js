// Scratch-off foil: covers an element with a shimmering layer you rub away
// with a finger (or mouse). Side-to-side rubbing scratches; up-and-down still
// scrolls the page. A "Reveal" button does the same for keyboards and
// screen readers.
import { h } from './ui.js';
import { sparkle } from './magic.js';

const KEY = 'bh-scratched';

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); }
}
export const isScratched = (id) => load().has(id);
function remember(id) {
  try { const set = load(); set.add(id); localStorage.setItem(KEY, JSON.stringify([...set])); } catch { /* private mode */ }
}

// Covers `host` (which must be position: relative). Calls onReveal once.
export function addScratchLayer(host, id, onReveal) {
  const canvas = h('canvas', { class: 'scratch', 'aria-hidden': 'true' });
  const reveal = h('button', { class: 'scratch-reveal', type: 'button', text: 'Reveal' });
  host.classList.add('scratchable');
  host.append(canvas, reveal);
  const ctx = canvas.getContext('2d');
  let w = 0, hgt = 0, done = false, moves = 0, last = null;

  function paint() {
    const r = host.getBoundingClientRect();
    if (!r.width) { requestAnimationFrame(paint); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; hgt = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const c = (v, d) => cs.getPropertyValue(v).trim() || d;
    const g = ctx.createLinearGradient(0, 0, w, hgt);
    g.addColorStop(0, c('--accent', '#41694a'));
    g.addColorStop(0.5, c('--motif-color', '#7f9d7a'));
    g.addColorStop(1, c('--accent', '#41694a'));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hgt);
    // a little glitter in the foil
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.25})`;
      const s = 1 + Math.random() * 2.2;
      ctx.fillRect(Math.random() * w, Math.random() * hgt, s, s);
    }
    ctx.fillStyle = c('--on-accent', '#fff');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 17px ${c('--font-body', 'sans-serif')}`;
    ctx.fillText('✨ Scratch to reveal ✨', w / 2, hgt / 2);
  }

  function scratchTo(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last ? last.x : x, last ? last.y : y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    last = { x, y };
    if (++moves % 8 === 0) {
      sparkle(canvas.getBoundingClientRect().left + x, canvas.getBoundingClientRect().top + y, 2);
      if (cleared() > 0.42) finish();
    }
  }

  // Share of the foil that has been rubbed away (sampled, so it's cheap).
  function cleared() {
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0, total = 0;
    for (let y = 0; y < height; y += 12) {
      for (let x = 0; x < width; x += 12) { total++; if (data[(y * width + x) * 4 + 3] < 40) clear++; }
    }
    return clear / total;
  }

  function finish() {
    if (done) return;
    done = true;
    remember(id);
    canvas.classList.add('gone');
    reveal.remove();
    host.classList.remove('scratchable');
    setTimeout(() => canvas.remove(), 500);
    onReveal?.();
  }

  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { last = null; const p = pos(e); scratchTo(p.x, p.y); });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && e.buttons !== 1) { last = null; return; }
    const p = pos(e); scratchTo(p.x, p.y);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, () => { last = null; if (moves > 6 && cleared() > 0.42) finish(); });
  reveal.addEventListener('click', finish);
  requestAnimationFrame(paint);
}
