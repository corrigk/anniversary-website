import { h, pageHead, loading, empty, countUp, toastError, divider, prefersReducedMotion } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { db, startDate, state } from '../data.js';
import { today, daysBetween, ymd, plural } from '../dates.js';

export async function render(root) {
  root.append(pageHead('Our stats', 'Counted live, growing every day.'));
  const box = h('div');
  root.append(box);
  box.append(loading('Counting everything…'));

  let s;
  try {
    const notNull = (col) => (x) => x.not(col, 'is', null);
    const eqTrue = (col) => (x) => x.eq(col, true);
    const [memories, photos, locs, songs, letters, opened, reasons, bucket, bucketDone, coupons, redeemed, puzzles, solved] = await Promise.all([
      db.count('memories'),
      db.count('memory_photos'),
      q(supabase.from('memories').select('location_text').not('location_text', 'is', null)),
      db.count('songs'),
      db.count('letters'),
      db.count('letters', notNull('opened_at')),
      db.count('reasons'),
      db.count('bucket_items'),
      db.count('bucket_items', eqTrue('done')),
      db.count('coupons'),
      db.count('coupons', eqTrue('redeemed')),
      db.count('puzzles'),
      db.count('puzzle_progress', (x) => x.eq('user_id', state.user.id)),
    ]);
    const places = new Set(locs.map((r) => normalizePlace(r.location_text)).filter(Boolean)).size;
    s = { memories, photos, places, songs, letters, opened, reasons, bucket, bucketDone, coupons, redeemed, puzzles, solved };
  } catch (err) {
    toastError(err);
    box.replaceChildren(empty('Couldn’t count things right now.'));
    return;
  }

  const start = startDate();
  const now = today();
  const days = start ? Math.max(0, daysBetween(start, now)) : 0;
  const span = start ? ymd(start, now) : null;

  const stat = (n, lbl, { of, wide } = {}) => {
    const num = h('div', { class: 'num' }, '0');
    countUp(num, n, { format: (x) => (of !== undefined ? `${x.toLocaleString()}/${of.toLocaleString()}` : x.toLocaleString()) });
    return h('div', { class: `card stat${wide ? ' wide' : ''}` }, num, h('div', { class: 'lbl' }, lbl));
  };

  const total = s.memories + s.photos + s.songs + s.letters + s.reasons + s.bucket + s.coupons;
  box.replaceChildren(
    h('div', { class: 'stats-grid' },
      stat(days, 'days together', { wide: true }),
      span ? h('p', { class: 'muted center', style: { gridColumn: '1 / -1', margin: '-.3rem 0 .2rem' } },
        [plural(span.years, 'year'), plural(span.months, 'month'), plural(span.days, 'day')].join(' · ')) : null,
      stat(s.memories, 'memories'),
      stat(s.photos, 'photos'),
      stat(s.places, s.places === 1 ? 'place' : 'places'),
      stat(s.songs, 'songs'),
      stat(s.opened, 'letters opened', { of: s.letters }),
      stat(s.reasons, 'reasons'),
      stat(s.bucketDone, 'bucket list done', { of: s.bucket }),
      stat(s.redeemed, 'coupons redeemed', { of: s.coupons }),
      stat(s.solved, 'puzzles you solved', { of: s.puzzles }),
    ),
    extraStats(),
    divider(),
    h('section', { class: 'card center' },
      h('h2', {}, 'Look how we’ve grown'),
      growthPlant(total),
      h('p', { class: 'muted small' }, `${plural(total, 'little thing')} planted so far. Every one helps it grow.`),
    ),
  );
}

// Hand-picked numbers from settings.extra_stats:
// [{ "emoji": "🗺️", "value": 11, "label": "states explored together" }, ...]
function extraStats() {
  const list = Array.isArray(state.settings.extra_stats) ? state.settings.extra_stats : [];
  if (!list.length) return null;
  return h('div', {},
    h('h2', { style: { margin: '1.5rem 0 .6rem' } }, 'And a few more'),
    h('div', { class: 'stats-grid' }, list.map((x) => {
      const whole = typeof x.value === 'number' && Number.isInteger(x.value);
      const num = h('div', { class: 'num' }, whole ? '0' : String(x.value ?? ''));
      if (whole) countUp(num, x.value);
      return h('div', { class: 'card stat' }, x.emoji ? h('div', { 'aria-hidden': 'true', style: { fontSize: '1.4rem' } }, x.emoji) : null, num, h('div', { class: 'lbl' }, String(x.label || '')));
    })));
}

// "Main St.", "main st" and " Main  St " count as one place.
function normalizePlace(t) {
  return (t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// ---------------------------------------------------------------------
// A plant that grows taller (and sprouts more leaves and blooms) as the
// total number of entries grows. Purely decorative.
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

function growthPlant(total) {
  const W = 280, H = 320, baseY = 290, cx = W / 2;
  const height = 50 + Math.min(1, Math.log10(total + 1) / 2.4) * 210; // 50..260
  const steps = 8;
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [cx + Math.sin(t * Math.PI * 1.6) * 16 * t, baseY - t * height];
  });
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i];
    d += ` Q${px} ${(py + y) / 2} ${(px + x) / 2} ${(py + y) / 2} T${x} ${y}`;
  }

  const animate = !prefersReducedMotion();
  const svg = svgEl('svg', { class: 'growth', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `A plant that has grown with ${total} entries` });
  const g = svgEl('g', { class: animate ? 'animate' : '', style: '--len: 1' });
  g.append(svgEl('ellipse', { class: 'soil', cx, cy: baseY + 8, rx: 70, ry: 14 }));
  g.append(svgEl('path', { class: 'stem', d, pathLength: 1 }));

  const leaves = Math.min(14, Math.max(1, Math.floor(total / 3)));
  for (let i = 0; i < leaves; i++) {
    const t = (i + 1) / (leaves + 1);
    const idx = Math.min(steps, Math.round(t * steps));
    const [x, y] = [pts[idx][0], baseY - t * height];
    const side = i % 2 ? 1 : -1;
    // Rotation sits on a wrapper so the CSS scale animation doesn't override it.
    const wrap = svgEl('g', { transform: `rotate(${side * -30} ${x + side * 14} ${y})` });
    wrap.append(svgEl('ellipse', {
      class: 'leaf', cx: x + side * 14, cy: y, rx: 14, ry: 6,
      style: `animation-delay:${0.4 + t * 2}s`,
    }));
    g.append(wrap);
  }

  const blooms = total >= 100 ? 3 : total >= 40 ? 2 : total >= 12 ? 1 : 0;
  const [tx, ty] = pts[steps];
  const spots = [[tx, ty], [tx - 34, ty + 40], [tx + 32, ty + 70]];
  for (let b = 0; b < blooms; b++) {
    const [bx, by] = spots[b];
    const flower = svgEl('g', { class: 'bloom', style: `animation-delay:${2.2 + b * 0.3}s` });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      flower.append(svgEl('circle', { cx: bx + Math.cos(a) * 8, cy: by + Math.sin(a) * 8, r: 7 }));
    }
    flower.append(svgEl('circle', { cx: bx, cy: by, r: 5, style: 'fill: var(--accent-3)' }));
    g.append(flower);
  }
  if (!blooms) g.append(svgEl('circle', { class: 'leaf', cx: tx, cy: ty, r: 5, style: 'animation-delay:2.2s' }));
  svg.append(g);
  return svg;
}
