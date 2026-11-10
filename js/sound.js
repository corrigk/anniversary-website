// A soft, generated soundscape (no audio files): slow bell notes over a quiet
// drone, in a different key and mood for each theme, plus little chimes for
// special moments. OFF by default; switched on in More -> "Soft music".
// Browsers only allow sound after a tap, so it starts on the first touch.

const KEY = 'bh-sound';
let ctx = null, master = null, wet = null;
let timer = null, drone = [];
let playing = false;

// Note numbers are semitones from A4 (440 Hz).
const MOODS = {
  garden:      { root: -9,  scale: [0, 2, 4, 7, 9, 12, 14, 16], gap: [2.6, 5.5], decay: 3.8 }, // C major pentatonic
  marian:      { root: -7,  scale: [0, 2, 4, 7, 9, 12, 16, 19], gap: [3.2, 6.5], decay: 4.6 }, // D, airy and high
  candlelight: { root: -12, scale: [0, 3, 5, 7, 10, 12, 15],    gap: [3.8, 7.5], decay: 5.2 }, // A minor, slow
  wildflower:  { root: -2,  scale: [0, 2, 4, 7, 9, 12, 14],     gap: [2.0, 4.2], decay: 3.0 }, // G, lighter
};
const mood = () => MOODS[document.documentElement.getAttribute('data-theme')] || MOODS.garden;
const hz = (semi) => 440 * 2 ** (semi / 12);
const rand = (a, b) => a + Math.random() * (b - a);

export function soundEnabled() {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  // a gentle echo for a sense of space
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.42;
  const fb = ctx.createGain();
  fb.gain.value = 0.38;
  wet = ctx.createGain();
  wet.gain.value = 0.35;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  master._send = delay;
  return true;
}

// One soft bell: a sine with a quieter octave above it, fading out slowly.
function bell(semi, { gain = 0.05, decay = 3.5, when = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(master);
  g.connect(master._send);
  for (const [mult, level] of [[1, 1], [2, 0.28], [3, 0.08]]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = hz(semi) * mult;
    og.gain.value = level;
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + decay + 0.1);
  }
}

function startDrone() {
  stopDrone();
  const m = mood();
  for (const [semi, level] of [[m.root - 12, 0.022], [m.root - 5, 0.012]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = hz(semi);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + 4);
    o.connect(g); g.connect(master);
    o.start();
    drone.push([o, g]);
  }
}
function stopDrone() {
  for (const [o, g] of drone) {
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      o.stop(ctx.currentTime + 1.3);
    } catch { /* already stopped */ }
  }
  drone = [];
}

function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  const m = mood();
  const note = m.root + m.scale[Math.floor(Math.random() * m.scale.length)];
  bell(note, { gain: rand(0.025, 0.05), decay: m.decay });
  if (Math.random() < 0.3) bell(note + (Math.random() < 0.5 ? 7 : 4), { gain: 0.02, decay: m.decay, when: rand(0.25, 0.6) });
  timer = setTimeout(schedule, rand(m.gap[0], m.gap[1]) * 1000);
}

function begin() {
  if (playing || !ensure()) return;
  playing = true;
  ctx.resume?.();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.5);
  startDrone();
  timer = setTimeout(schedule, 600);
}

function end() {
  playing = false;
  clearTimeout(timer);
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
  stopDrone();
}

// Called from a tap (the More toggle), so the browser lets sound start.
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  on ? begin() : end();
}

// If sound was left on, wait for the first touch of this visit, then start.
export function initSound() {
  if (!soundEnabled()) return;
  const go = () => { if (soundEnabled()) begin(); };
  document.addEventListener('pointerdown', go, { once: true });
  document.addEventListener('keydown', go, { once: true });
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { clearTimeout(timer); ctx.suspend?.(); }
  else if (playing) { ctx.resume?.(); timer = setTimeout(schedule, 800); }
});
new MutationObserver(() => { if (playing) startDrone(); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// Little chimes for special moments. Silent unless sound is on.
export function chime(kind = 'sparkle', pos = 0.5) {
  if (!playing || !ctx) return;
  const m = mood();
  const at = (i) => m.root + m.scale[Math.min(m.scale.length - 1, Math.max(0, i))];
  if (kind === 'celebrate') {
    [0, 2, 3, 5].forEach((i, k) => bell(at(i) + 12, { gain: 0.05, decay: 2.6, when: k * 0.11 }));
  } else if (kind === 'bloom') {
    [1, 3].forEach((i, k) => bell(at(i) + 12, { gain: 0.045, decay: 2.4, when: k * 0.14 }));
  } else if (kind === 'star') {
    bell(at(Math.round(pos * (m.scale.length - 1))) + 12, { gain: 0.05, decay: 2.8 });
  } else {
    bell(at(4) + 12, { gain: 0.035, decay: 1.8 });
  }
}
