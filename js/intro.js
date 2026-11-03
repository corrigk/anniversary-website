// The first-open welcome: a wreath draws itself, leaves unfurl, and a sealed
// emblem waits to be tapped. Shown once per person per device; replay it from
// More -> "Replay the welcome".
import { h } from './ui.js';
import { state, myName, startDate } from './data.js';
import { today, nextAnniversary, ymd, ordinal } from './dates.js';
import { celebrate } from './magic.js';

const key = () => `bh-welcomed-${state.user?.id}`;
const NS = 'http://www.w3.org/2000/svg';

export function maybeShowIntro() {
  let seen = false;
  try { seen = localStorage.getItem(key()) === '1'; } catch { /* private mode */ }
  if (!seen) showIntro();
}

export function showIntro() {
  if (document.querySelector('.intro')) return;
  const start = startDate();
  const now = today();
  const ann = start ? nextAnniversary(start, now) : null;
  const isDay = ann && ann.daysAway === 0 && ann.number > 0;
  const years = start ? ymd(start, now).years : 0;

  const title = isDay ? `Happy ${ordinal(ann.number)} anniversary` : 'Welcome to our little garden';
  const line = isDay
    ? 'Every single day of it has been a gift.'
    : ann && ann.number > 1 && ann.daysAway <= 45
      ? `Almost ${ann.number} years of us, planted here one memory at a time.`
      : years > 0
        ? `${years} year${years === 1 ? '' : 's'} of us, planted here one memory at a time.`
      : 'Planted here one memory at a time.';

  const open = h('button', { class: 'btn intro-open', type: 'button', text: 'Open it ♡' });
  const box = h('div', { class: 'intro', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' },
    h('div', { class: 'intro-inner' },
      h('p', { class: 'intro-for' }, `For you, ${myName()}`),
      wreath(),
      h('h1', { id: 'intro-title', class: 'intro-title' }, title),
      h('p', { class: 'intro-line' }, line),
      open,
    ),
  );
  document.body.append(box);
  document.body.style.overflow = 'hidden';
  setTimeout(() => open.focus({ preventScroll: true }), 1600);

  const finish = () => {
    try { localStorage.setItem(key(), '1'); } catch { /* ignore */ }
    box.classList.add('opening');
    const r = box.querySelector('.wreath').getBoundingClientRect();
    celebrate(r.left + r.width / 2, r.top + r.height / 2, { n: 70 });
    setTimeout(() => { box.remove(); document.body.style.overflow = ''; }, 1100);
  };
  open.addEventListener('click', finish, { once: true });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
}

// A circular vine with leaves and four small blooms, built as SVG nodes.
function wreath() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'wreath');
  svg.setAttribute('aria-hidden', 'true');
  const el = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  svg.append(el('circle', { class: 'wreath-ring', cx: 100, cy: 100, r: 78, pathLength: 1 }));
  const LEAVES = 18;
  for (let i = 0; i < LEAVES; i++) {
    const a = (i / LEAVES) * 360;
    const g = el('g', { transform: `rotate(${a} 100 100)` });
    const side = i % 2 ? 1 : -1;
    g.append(el('path', {
      class: 'wreath-leaf',
      d: `M100 22 Q ${100 + side * 8} 11 ${100 + side * 18} 15 Q ${100 + side * 10} 26 100 22 Z`,
      style: `animation-delay:${0.25 + (i / LEAVES) * 1.4}s`,
    }));
    svg.append(g);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cx = 100 + Math.cos(a) * 78, cy = 100 + Math.sin(a) * 78;
    const bloom = el('g', { class: 'wreath-bloom', style: `animation-delay:${1.5 + i * 0.15}s` });
    for (let k = 0; k < 5; k++) {
      const b = (k / 5) * Math.PI * 2;
      bloom.append(el('circle', { cx: cx + Math.cos(b) * 5, cy: cy + Math.sin(b) * 5, r: 4.6 }));
    }
    bloom.append(el('circle', { class: 'wreath-heart', cx, cy, r: 3 }));
    svg.append(bloom);
  }
  const wrap = h('div', { class: 'wreath-wrap' }, svg, h('span', { class: 'intro-emblem', 'aria-hidden': 'true' }));
  return wrap;
}
