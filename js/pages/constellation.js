// Constellation of us: every memory is a star, placed in order around a
// heart. The line draws itself from the first star to the latest.
import { h, s, pageHead, empty, loading, toastError, seeded, prefersReducedMotion } from '../ui.js';
import { loadMemories, openMemory } from '../memories.js';
import { formatDate } from '../dates.js';
import { sparkle } from '../magic.js';
import { chime } from '../sound.js';

const SIZE = 1000;

// n points spaced evenly along a heart curve, starting at the top dip and
// travelling clockwise, in a SIZE x SIZE box.
function heartPoints(n) {
  const raw = [];
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([500 + x * 25.5, 455 - y * 25.5]);
  }
  const acc = [0];
  for (let i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  const total = acc[acc.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < acc.length - 2 && acc[j + 1] < target) j++;
    const f = (target - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]);
    out.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f]);
  }
  return out;
}

export async function render(root) {
  const box = h('div');
  root.append(pageHead('Constellation of us', 'Every star is a memory. Together they make this.'), box);
  box.append(loading('Waiting for the stars to come out…'));

  let rows;
  try { rows = await loadMemories(); }
  catch (err) { toastError(err); box.replaceChildren(empty('Couldn’t find the stars tonight.')); return; }
  if (rows.length < 3) { box.replaceChildren(empty('Add a few memories to the timeline and they’ll rise here as stars.')); return; }

  const n = rows.length;
  const pts = heartPoints(n);
  const still = prefersReducedMotion();
  const DRAW = 5.2; // seconds for the line to draw

  const svg = s('svg', { class: `sky${still ? '' : ' animate'}`, viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'img', 'aria-label': `A heart-shaped constellation of ${n} memories` });

  // faint background stars
  for (let i = 0; i < 110; i++) {
    svg.append(s('circle', {
      class: 'bg-star', cx: seeded('bg', i) * SIZE, cy: seeded('bg', i + 500) * SIZE, r: 0.8 + seeded('bg', i + 900) * 2,
      style: `animation-delay:${(-seeded('bg', i + 77) * 6).toFixed(2)}s; animation-duration:${(3 + seeded('bg', i + 33) * 4).toFixed(2)}s`,
    }));
  }

  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  svg.append(
    s('path', { class: 'const-line', d, pathLength: 1, style: `animation-duration:${DRAW}s` }),
    s('path', { class: 'const-close', d: `M${pts[n - 1][0].toFixed(1)} ${pts[n - 1][1].toFixed(1)} L${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`, style: `animation-delay:${DRAW}s` }),
  );

  // year labels, tucked just inside the heart
  let lastYear = null;
  rows.forEach((m, i) => {
    const y = m.happened_on.slice(0, 4);
    if (y === lastYear) return;
    lastYear = y;
    const [px, py] = pts[i];
    const dx = px - 500, dy = py - 470, len = Math.hypot(dx, dy) || 1;
    const lx = px - (dx / len) * 64, ly = py - (dy / len) * 64; // tucked just inside the heart
    svg.append(s('text', {
      class: 'year-label', x: lx.toFixed(1), y: (ly + 10).toFixed(1),
      'text-anchor': lx < 400 ? 'start' : lx > 600 ? 'end' : 'middle',
      style: `animation-delay:${((i / n) * DRAW).toFixed(2)}s`,
    }, y));
  });

  const ring = s('circle', { class: 'ring', r: 26, cx: -100, cy: -100 });
  svg.append(ring);
  const stars = rows.map((m, i) => {
    const [x, y] = pts[i];
    const big = i === 0 || i === n - 1;
    const g = s('g', { class: `star${big ? ' big' : ''}`, style: `animation-delay:${((i / n) * DRAW).toFixed(2)}s` },
      s('circle', { class: 'halo', cx: x, cy: y, r: big ? 24 : 16 }),
      s('circle', { class: 'core', cx: x, cy: y, r: big ? 8.5 : 5.5 + seeded(m.id, 1) * 2 }));
    svg.append(g);
    return g;
  });

  // words in the middle of the heart
  svg.append(s('g', { class: 'sky-words', style: `animation-delay:${DRAW + 0.4}s` },
    s('text', { class: 'sky-count', x: 500, y: 430, 'text-anchor': 'middle' }, String(n)),
    s('text', { class: 'sky-sub', x: 500, y: 492, 'text-anchor': 'middle' }, 'memories'),
    s('text', { class: 'sky-sub small', x: 500, y: 540, 'text-anchor': 'middle' }, 'and counting'),
  ));

  // the card under the sky
  const kicker = h('p', { class: 'tl-date', style: { margin: 0 } }, 'Tap a star');
  const title = h('h3', { style: { margin: '.1rem 0 .2rem' } }, 'or let the story play');
  const caption = h('p', { class: 'muted const-caption' });
  const counter = h('span', { class: 'muted small', 'aria-hidden': 'true' });
  const prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Earlier memory', text: '‹' });
  const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Later memory', text: '›' });
  const openBtn = h('button', { class: 'btn small', type: 'button', text: 'Open memory', hidden: true });
  const play = h('button', { class: 'btn soft small', type: 'button', 'aria-pressed': 'false', text: '▶ Play our story' });
  const info = h('section', { class: 'card const-info', 'aria-live': 'polite' },
    h('div', { class: 'grow' }, kicker, title, caption),
    h('div', { class: 'row' }, prev, counter, next, h('span', { class: 'spacer' }), play, openBtn));

  let current = -1;
  let playing = null;

  function select(i, { quiet = false } = {}) {
    current = (i + n) % n;
    const m = rows[current];
    stars.forEach((g, k) => g.classList.toggle('selected', k === current));
    ring.setAttribute('cx', pts[current][0]);
    ring.setAttribute('cy', pts[current][1]);
    ring.classList.remove('pulse');
    void ring.getBoundingClientRect();
    ring.classList.add('pulse');
    kicker.textContent = formatDate(m.happened_on, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    title.textContent = m.title;
    caption.textContent = m.caption || '';
    counter.textContent = `${current + 1} / ${n}`;
    openBtn.hidden = false;
    if (!quiet) {
      const r = stars[current].querySelector('.core').getBoundingClientRect();
      sparkle(r.left + r.width / 2, r.top + r.height / 2, 6);
      chime('star', current / n);
    }
  }

  function stop() {
    clearInterval(playing);
    playing = null;
    play.textContent = '▶ Play our story';
    play.setAttribute('aria-pressed', 'false');
  }
  play.addEventListener('click', () => {
    if (playing) { stop(); return; }
    play.textContent = '❚❚ Pause';
    play.setAttribute('aria-pressed', 'true');
    select(current < 0 || current === n - 1 ? 0 : current + 1);
    playing = setInterval(() => { if (current === n - 1) { stop(); return; } select(current + 1); }, 2600);
  });
  prev.addEventListener('click', () => { stop(); select(current < 0 ? n - 1 : current - 1); });
  next.addEventListener('click', () => { stop(); select(current + 1); });
  openBtn.addEventListener('click', () => { stop(); if (current >= 0) openMemory(rows[current]); });

  // Tap anywhere on the sky: the nearest star answers.
  svg.addEventListener('click', (e) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    let best = -1, bestD = Infinity;
    pts.forEach(([x, y], i) => { const dist = Math.hypot(x - p.x, y - p.y); if (dist < bestD) { bestD = dist; best = i; } });
    if (best >= 0 && bestD < 140) { stop(); select(best); }
  });
  info.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { stop(); select(current + 1); }
    if (e.key === 'ArrowLeft') { stop(); select(current < 0 ? n - 1 : current - 1); }
  });

  box.replaceChildren(h('div', { class: 'sky-wrap' }, svg), info);
  return () => clearInterval(playing);
}
