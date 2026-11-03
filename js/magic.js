// The magic layer: ambient particles behind the page (fireflies, stars, embers
// or pollen, depending on the theme's --magic-kind), little sparkles wherever
// you tap, and celebration bursts. Two fixed canvases, pointer-events: none.
// Everything switches off with "Reduce motion" or the Sparkles toggle in More.

const KEY = 'bh-magic';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function magicEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setMagic(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  on ? start() : stop();
}

let back, front, bctx, fctx, dpr = 1, W = 0, H = 0;
let ambient = [], bursts = [], raf = 0, running = false, last = 0;
let theme = { kind: 'fireflies', rgb: [214, 168, 60], rgb2: [127, 157, 122] };
const sprites = new Map();

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (v, d) => (cs.getPropertyValue(v).trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n)).slice(0, 3) || d);
  const a = rgb('--magic-rgb'), b = rgb('--magic-rgb-2');
  theme = {
    kind: cs.getPropertyValue('--magic-kind').trim() || 'fireflies',
    rgb: a.length === 3 ? a : [214, 168, 60],
    rgb2: b.length === 3 ? b : a.length === 3 ? a : [127, 157, 122],
  };
  sprites.clear();
}

// A soft glowing dot, pre-rendered once per colour (much cheaper than shadows).
function glow(rgb) {
  const k = rgb.join(',');
  if (sprites.has(k)) return sprites.get(k);
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${k},1)`);
  grad.addColorStop(0.18, `rgba(${k},.85)`);
  grad.addColorStop(0.45, `rgba(${k},.22)`);
  grad.addColorStop(1, `rgba(${k},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  sprites.set(k, c);
  return c;
}

function makeCanvas(z) {
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.className = 'magic-canvas';
  c.style.zIndex = z;
  document.body.prepend(c);
  return c;
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  for (const c of [back, front]) {
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = `${W}px`; c.style.height = `${H}px`;
  }
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedAmbient();
}

const rand = (a, b) => a + Math.random() * (b - a);

function seedAmbient() {
  const count = Math.round(Math.min(34, Math.max(14, (W * H) / 26000)));
  ambient = Array.from({ length: count }, () => newMote(true));
}

function newMote(anywhere) {
  const k = theme.kind;
  const m = {
    x: rand(0, W), y: anywhere ? rand(0, H) : (k === 'embers' || k === 'pollen' ? H + 10 : rand(0, H)),
    r: rand(3, 7), phase: rand(0, Math.PI * 2), speed: rand(0.4, 1.1), alt: Math.random() < 0.35,
    vx: rand(-0.15, 0.15), vy: 0, life: 0,
  };
  if (k === 'stars') { m.r = rand(1.2, 3); m.speed = rand(0.6, 1.8); }
  if (k === 'embers') { m.vy = -rand(0.15, 0.45); m.r = rand(2.5, 5.5); }
  if (k === 'pollen') { m.vy = -rand(0.08, 0.25); m.r = rand(2, 4.5); }
  return m;
}

let shooting = null, nextShoot = 0;

function drawAmbient(t, dt) {
  bctx.clearRect(0, 0, W, H);
  const k = theme.kind;
  for (const m of ambient) {
    m.phase += 0.0012 * dt * m.speed;
    let a;
    if (k === 'stars') {
      a = 0.25 + 0.55 * Math.pow((Math.sin(m.phase * 2.2) + 1) / 2, 3);
      drawStar(bctx, m.x, m.y, m.r * (0.8 + a * 0.6), m.alt ? theme.rgb2 : theme.rgb, a);
      continue;
    }
    if (k === 'fireflies') {
      m.x += Math.cos(m.phase * 0.9) * 0.18 * m.speed + m.vx;
      m.y += Math.sin(m.phase * 1.3) * 0.16 * m.speed;
      a = 0.15 + 0.6 * Math.pow((Math.sin(m.phase * 2.6) + 1) / 2, 4);
    } else { // embers & pollen drift upward, swaying
      m.x += Math.sin(m.phase) * 0.25 + m.vx;
      m.y += m.vy * dt * 0.06;
      a = k === 'embers' ? 0.25 + 0.45 * ((Math.sin(m.phase * 5) + 1) / 2) : 0.35 + 0.3 * Math.sin(m.phase * 2);
      if (m.y < -20) Object.assign(m, newMote(false));
    }
    if (m.x < -20) m.x = W + 10; else if (m.x > W + 20) m.x = -10;
    if (m.y < -20 && k === 'fireflies') m.y = H + 10; else if (m.y > H + 20) m.y = -10;
    const s = m.r * 6;
    bctx.globalAlpha = Math.max(0, Math.min(1, a));
    bctx.drawImage(glow(m.alt ? theme.rgb2 : theme.rgb), m.x - s / 2, m.y - s / 2, s, s);
  }
  bctx.globalAlpha = 1;

  // Marian: an occasional shooting star
  if (k === 'stars') {
    if (!shooting && t > nextShoot) {
      shooting = { x: rand(W * 0.2, W), y: rand(0, H * 0.35), life: 0 };
      nextShoot = t + rand(9000, 18000);
    }
    if (shooting) {
      shooting.life += dt;
      const p = shooting.life / 900;
      const x = shooting.x - p * 220, y = shooting.y + p * 110;
      const grad = bctx.createLinearGradient(x, y, x + 70, y - 35);
      grad.addColorStop(0, `rgba(${theme.rgb.join(',')},${0.8 * (1 - p)})`);
      grad.addColorStop(1, `rgba(${theme.rgb.join(',')},0)`);
      bctx.strokeStyle = grad; bctx.lineWidth = 1.6; bctx.lineCap = 'round';
      bctx.beginPath(); bctx.moveTo(x, y); bctx.lineTo(x + 70, y - 35); bctx.stroke();
      if (p >= 1) shooting = null;
    }
  }
}

function drawStar(ctx, x, y, r, rgb, a) {
  ctx.fillStyle = `rgba(${rgb.join(',')},${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2);
  ctx.quadraticCurveTo(x, y, x + r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 2);
  ctx.quadraticCurveTo(x, y, x - r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 2);
  ctx.fill();
}

function drawHeart(ctx, x, y, s, rgb, a) {
  ctx.fillStyle = `rgba(${rgb.join(',')},${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fill();
}

function drawPetal(ctx, x, y, s, rot, rgb, a) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = `rgba(${rgb.join(',')},${a})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.45, s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBursts(dt) {
  fctx.clearRect(0, 0, W, H);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i];
    p.life += dt;
    if (p.life > p.ttl) { bursts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.vx *= p.drag; p.vy *= p.drag;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.spin * dt;
    const a = Math.min(1, 2.2 * (1 - p.life / p.ttl));
    if (p.shape === 'heart') drawHeart(fctx, p.x, p.y, p.s, p.rgb, a);
    else if (p.shape === 'petal') drawPetal(fctx, p.x, p.y, p.s, p.rot, p.rgb, a * 0.9);
    else if (p.shape === 'star') drawStar(fctx, p.x, p.y, p.s * 0.5, p.rgb, a);
    else {
      const s = p.s * 4;
      fctx.globalAlpha = a;
      fctx.drawImage(glow(p.rgb), p.x - s / 2, p.y - s / 2, s, s);
      fctx.globalAlpha = 1;
    }
  }
}

function loop(t) {
  if (!running) return;
  const dt = Math.min(48, t - (last || t));
  last = t;
  drawAmbient(t, dt);
  if (bursts.length) drawBursts(dt);
  else if (fctx) fctx.clearRect(0, 0, W, H);
  raf = requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------
export function start() {
  if (running || reduced() || !magicEnabled()) return;
  if (!back) {
    back = makeCanvas(0);
    front = makeCanvas(95);
    bctx = back.getContext('2d');
    fctx = front.getContext('2d');
    window.addEventListener('resize', () => running && resize(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); running = false; }
      else if (magicEnabled() && !reduced()) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    });
    document.addEventListener('pointerdown', onTap, { passive: true });
    new MutationObserver(() => { readTheme(); if (running) seedAmbient(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  back.hidden = front.hidden = false;
  readTheme();
  resize();
  running = true;
  last = 0;
  raf = requestAnimationFrame(loop);
}

export function stop() {
  running = false;
  cancelAnimationFrame(raf);
  bursts = [];
  if (back) { bctx.clearRect(0, 0, W, H); fctx.clearRect(0, 0, W, H); back.hidden = front.hidden = true; }
}

function onTap(e) {
  if (!running || e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.target.closest?.('input, textarea, select, .lightbox')) return;
  sparkle(e.clientX, e.clientY, 7);
}

// A small sparkle at a point (taps).
export function sparkle(x, y, n = 7) {
  if (!running) return;
  for (let i = 0; i < n; i++) {
    const ang = rand(0, Math.PI * 2), sp = rand(0.05, 0.18);
    bursts.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.05, g: 0.00012, drag: 0.985,
      s: rand(3, 6), rot: 0, spin: 0, life: 0, ttl: rand(500, 850),
      shape: i % 3 === 0 ? 'star' : 'dot', rgb: i % 2 ? theme.rgb : theme.rgb2,
    });
  }
}

// A big celebration: hearts, petals and stars bloom out of a point (or the
// middle of the screen) and drift down. Used for redeeming, solving, etc.
export function celebrate(x = W / 2, y = H * 0.4, { n = 46, haptic = true } = {}) {
  if (haptic && navigator.vibrate) { try { navigator.vibrate([12, 40, 18]); } catch { /* ignore */ } }
  if (!running) return;
  const cs = getComputedStyle(document.documentElement);
  const hex = (v) => {
    const m = cs.getPropertyValue(v).trim().match(/^#([0-9a-f]{6})$/i);
    return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : theme.rgb;
  };
  const palette = [theme.rgb, theme.rgb2, hex('--accent'), hex('--petal-color'), hex('--accent-2')];
  for (let i = 0; i < n; i++) {
    const ang = rand(-Math.PI, 0) + rand(-0.4, 0.4), sp = rand(0.18, 0.55);
    bursts.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 0.00055, drag: 0.982,
      s: rand(5, 10), rot: rand(0, 6), spin: rand(-0.006, 0.006), life: 0, ttl: rand(1600, 2600),
      shape: ['heart', 'petal', 'star', 'petal', 'dot'][i % 5], rgb: palette[i % palette.length],
    });
  }
}

// Celebrate from an element's centre.
export function celebrateAt(el, opts) {
  const r = el?.getBoundingClientRect?.();
  if (r) celebrate(r.left + r.width / 2, r.top + r.height / 2, opts);
  else celebrate(undefined, undefined, opts);
}
