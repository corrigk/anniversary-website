// Photo framing: choose which part of a photo stays in view when a card crops
// it (cards show photos 4:3). Stored per photo as focus_x / focus_y (0 to 1,
// the CSS object-position, where 0.5 / 0.5 is the centre), so the full photo is
// never changed and the full-screen viewer still shows all of it.
import { h, openSheet } from './ui.js';

const CARD_ASPECT = 4 / 3;
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const round = (n) => Math.round(n * 1000) / 1000;

// The saved focus point of a memory_photos row, or null for "centred".
export const focusOf = (p) => (p && p.focus_x != null && p.focus_y != null ? { x: +p.focus_x, y: +p.focus_y } : null);
export const objectPosition = (f) => (f ? `${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%` : '50% 50%');
export const sameFocus = (a, b) => (!a && !b) || (a && b && Math.abs(a.x - b.x) < 0.002 && Math.abs(a.y - b.y) < 0.002);
export const isCentred = (f) => !f || (Math.abs(f.x - 0.5) < 0.002 && Math.abs(f.y - 0.5) < 0.002);

// What share of the photo a 4:3 card shows (1 = all of it along that side).
function visibleShare(aspect) {
  return aspect < CARD_ASPECT ? { w: 1, h: aspect / CARD_ASPECT } : { w: CARD_ASPECT / aspect, h: 1 };
}

// Opens a sheet showing the whole photo with the card's view drawn on top.
// Drag or tap to put the view where you want it (aim at the faces).
export function openFocusPicker({ src, alt = 'Photo', focus = null, onDone }) {
  // Work in "centre of the view" terms (cx, cy), which is what you point at;
  // convert to/from object-position when reading and saving.
  let cx = 0.5, cy = 0.5, share = { w: 1, h: 1 };

  const img = h('img', { class: 'focus-img', src, alt, draggable: false });
  const win = h('div', { class: 'focus-window', 'aria-hidden': 'true' });
  const dot = h('span', { class: 'focus-dot', 'aria-hidden': 'true' });
  const stage = h('div', {
    class: 'focus-stage', tabindex: '0', role: 'group',
    'aria-label': 'Drag to move the card’s view over the photo. Arrow keys also work.',
  }, img, win, dot);

  const rect = () => {
    const left = clamp(cx - share.w / 2, 0, 1 - share.w);
    const top = clamp(cy - share.h / 2, 0, 1 - share.h);
    return { left, top };
  };
  const toPos = () => {
    const { left, top } = rect();
    return {
      x: share.w < 1 ? left / (1 - share.w) : 0.5,
      y: share.h < 1 ? top / (1 - share.h) : 0.5,
    };
  };
  const sync = () => {
    const { left, top } = rect();
    win.style.left = `${left * 100}%`;
    win.style.top = `${top * 100}%`;
    win.style.width = `${share.w * 100}%`;
    win.style.height = `${share.h * 100}%`;
    dot.style.left = `${cx * 100}%`;
    dot.style.top = `${cy * 100}%`;
  };
  const setFrom = (e) => {
    const r = img.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cx = clamp((e.clientX - r.left) / r.width);
    cy = clamp((e.clientY - r.top) / r.height);
    sync();
  };

  let dragging = false;
  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    try { stage.setPointerCapture?.(e.pointerId); } catch { /* the finger already lifted */ }
    setFrom(e);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => { if (dragging) setFrom(e); });
  for (const ev of ['pointerup', 'pointercancel']) stage.addEventListener(ev, () => { dragging = false; });
  stage.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.03;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    cx = clamp(cx + moves[e.key][0]);
    cy = clamp(cy + moves[e.key][1]);
    sync();
  });

  // Once the photo's shape is known: size the window, and place it where the saved framing puts it.
  const ready = () => {
    if (!img.naturalWidth) return;
    share = visibleShare(img.naturalWidth / img.naturalHeight);
    if (focus) {
      cx = share.w < 1 ? focus.x * (1 - share.w) + share.w / 2 : 0.5;
      cy = share.h < 1 ? focus.y * (1 - share.h) + share.h / 2 : 0.5;
    }
    sync();
  };

  const reset = h('button', { class: 'btn ghost small', type: 'button', text: 'Centre it' });
  const done = h('button', { class: 'btn', type: 'button', text: 'Done' });
  const s = openSheet({
    title: 'Frame this photo',
    body: h('div', {},
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'The bright box is what shows on the timeline card. Drag on the photo to move it, and aim at the faces.'),
      stage,
    ),
    footer: [reset, h('span', { class: 'spacer' }), done],
  });
  reset.addEventListener('click', () => { cx = 0.5; cy = 0.5; sync(); });
  done.addEventListener('click', () => {
    const p = toPos();
    const next = { x: round(p.x), y: round(p.y) };
    s.close();
    onDone(isCentred(next) ? null : next);
  });
  if (img.complete) ready(); else img.addEventListener('load', ready);
  sync();
  return s;
}
