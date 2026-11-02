// Entry point: auth, the app shell, and the hash router (#/timeline).
import { supabase, friendlyError } from './supabase.js';
import { state, loadShared } from './data.js';
import { h, sprig, loading, toast, toastError, openSheet } from './ui.js';
import { listThemes, applyTheme, currentTheme, initTheme, themePreview } from './theme.js';
import { SITE_TITLE } from './config.js';

const app = document.getElementById('app');

// route -> { file, title, emoji, nav: 'tab' | 'extra' | null }
export const ROUTES = {
  '':          { file: 'home',       title: 'Home',         emoji: '🏡', nav: 'tab' },
  timeline:    { file: 'timeline',   title: 'Timeline',     emoji: '📸', nav: 'tab' },
  letters:     { file: 'letters',    title: 'Letters',      emoji: '💌', nav: 'tab' },
  songs:       { file: 'songs',      title: 'Songs',        emoji: '🎵', nav: 'extra' },
  puzzles:     { file: 'puzzles',    title: 'Puzzles',      emoji: '🧩', nav: 'extra' },
  reasons:     { file: 'reasons',    title: 'Reasons',      emoji: '💛', nav: 'extra' },
  coupons:     { file: 'coupons',    title: 'Coupons',      emoji: '🎟️', nav: 'extra' },
  bucket:      { file: 'bucket',     title: 'Bucket list',  emoji: '✅', nav: 'extra' },
  countdowns:  { file: 'countdowns', title: 'Countdowns',   emoji: '⏳', nav: 'extra' },
  stats:       { file: 'stats',      title: 'Our stats',    emoji: '🌱', nav: 'extra' },
  more:        { file: 'more',       title: 'More',         emoji: '☰',  nav: 'more' },
  finale:      { file: 'finale',     title: 'A surprise',   emoji: '🎁', nav: null },
  admin:       { file: 'admin',      title: 'Admin',        emoji: '🔧', nav: null },
};

let view = null;
let cleanup = null;
let renderToken = 0;
let started = false;

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
const bootHash = location.hash;
const isRecovery = /type=recovery/.test(bootHash);
const hashError = /(^#|&)error=/.test(bootHash) ? new URLSearchParams(bootHash.slice(1)).get('error_description') : null;

supabase.auth.onAuthStateChange((event, session) => {
  // Never await Supabase calls inside this callback (supabase-js can deadlock); defer instead.
  setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') showNewPassword();
    else if (event === 'SIGNED_OUT') { state.user = null; started = false; showLogin(); }
    else if (event === 'SIGNED_IN' && session && !started) enter(session.user);
  }, 0);
});

(async function boot() {
  let session = null;
  try {
    ({ data: { session } } = await supabase.auth.getSession());
  } catch (err) {
    console.warn(err);
  }
  if (/access_token=|error=/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  if (hashError) toast(`That link didn’t work: ${hashError.replace(/\+/g, ' ')}. You can request a new one.`, 'error', 6000);

  if (session) await enter(session.user);
  else showLogin();
  if (isRecovery && session) showNewPassword();
})();

async function showLogin() {
  cleanup?.(); cleanup = null;
  view = null;
  const { render } = await import('./pages/login.js');
  document.title = SITE_TITLE;
  render(app);
}

async function enter(user) {
  if (started) return;
  started = true;
  state.user = user;
  app.replaceChildren(h('div', { class: 'boot' }, sprig('spin')));
  try {
    await loadShared();
  } catch (err) {
    started = false;
    app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-card card' },
      h('h2', {}, 'Hmm, something went wrong'),
      h('p', { class: 'muted' }, friendlyError(err)),
      h('button', { class: 'btn', type: 'button', onclick: () => location.reload(), text: 'Try again' }),
    )));
    return;
  }
  if (!state.profiles.has(user.id)) {
    app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'login-card card' },
      h('h2', {}, 'This garden is just for two'),
      h('p', { class: 'muted' }, 'This account isn’t set up as a member yet. (Bubs: add it to couple_members and profiles.)'),
      h('button', { class: 'btn', type: 'button', onclick: () => supabase.auth.signOut(), text: 'Sign out' }),
    )));
    return;
  }
  initTheme(state.settings.default_theme);
  renderShell();
  route();
}

window.addEventListener('hashchange', () => { if (view) route(); });

// ---------------------------------------------------------------------
// Shell + router
// ---------------------------------------------------------------------
function navLink(key) {
  const r = ROUTES[key];
  return h('a', {
    href: `#/${key}`, class: r.nav === 'extra' ? 'nav-extra' : r.nav === 'more' ? 'nav-more' : null, dataset: { route: key },
  }, h('span', { class: 'ico', 'aria-hidden': 'true' }, r.emoji), h('span', {}, r.title));
}

function renderShell() {
  view = h('main', { id: 'view', tabindex: '-1' });
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Main' }, Object.keys(ROUTES).filter((k) => ROUTES[k].nav).map(navLink));
  const top = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/' }, sprig(), SITE_TITLE),
    h('span', { class: 'spacer' }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Change theme', title: 'Change theme', onclick: openThemePicker, text: '🎨' }),
  );
  app.replaceChildren(h('div', { class: 'shell' }, top, nav, view));
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { key: path.split('/')[0] || '', params: new URLSearchParams(query) };
}

async function route() {
  const { key, params } = parseHash();
  const r = ROUTES[key] || ROUTES[''];
  const token = ++renderToken;
  try { cleanup?.(); } catch (e) { console.warn(e); }
  cleanup = null;

  const routeKey = ROUTES[key] ? key : '';
  const moreKeys = Object.keys(ROUTES).filter((k) => ROUTES[k].nav === 'extra' || k === 'more');
  document.querySelectorAll('.tabs a').forEach((a) => {
    const k = a.dataset.route;
    const active = k === routeKey || (k === 'more' && moreKeys.includes(routeKey) && window.innerWidth < 768);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  document.title = r.file === 'home' ? SITE_TITLE : `${r.title} · ${SITE_TITLE}`;
  view.replaceChildren(loading());
  window.scrollTo(0, 0);
  try {
    const mod = await import(`./pages/${r.file}.js`);
    if (token !== renderToken) return;
    const container = h('div', { class: 'page' });
    view.replaceChildren(container);
    const c = await mod.render(container, { params });
    if (token !== renderToken) { c?.(); return; }
    cleanup = typeof c === 'function' ? c : null;
    view.focus({ preventScroll: true });
  } catch (err) {
    if (token !== renderToken) return;
    toastError(err);
    view.replaceChildren(h('div', { class: 'empty' }, sprig(), h('p', {}, 'This page didn’t load. '), h('button', { class: 'btn', type: 'button', onclick: route, text: 'Try again' })));
  }
}

// ---------------------------------------------------------------------
// Theme picker (also opened from the More page)
// ---------------------------------------------------------------------
export function openThemePicker() {
  const buttons = listThemes().map((t) => {
    const c = themePreview(t.id);
    const b = h('button', {
      class: 'swatch', type: 'button', 'aria-pressed': String(t.id === currentTheme()),
      style: { background: c['--bg'] || '#fff', color: c['--text'] || '#222', fontFamily: c['--font-head'] || 'serif' },
      onclick: () => {
        applyTheme(t.id);
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      },
    },
      h('span', { class: 'dots', 'aria-hidden': 'true' }, ['--accent', '--accent-2', '--motif-color', '--surface'].map((k) => h('i', { style: { background: c[k] || '#ccc' } }))),
      h('b', {}, t.label),
    );
    return b;
  });
  openSheet({
    title: 'Pick a look',
    body: h('div', {},
      h('p', { class: 'muted small' }, 'Tap to try one on. Your choice is saved on this device.'),
      h('div', { class: 'themes' }, buttons),
    ),
  });
}

// ---------------------------------------------------------------------
// Password recovery: set a new password after following the email link
// ---------------------------------------------------------------------
let recoveryOpen = false;
function showNewPassword() {
  if (recoveryOpen) return;
  recoveryOpen = true;
  const pw = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, id: 'np1' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, id: 'np2' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const save = h('button', { class: 'btn block', type: 'submit', text: 'Save new password' });
  const form = h('form', {},
    h('label', { class: 'field', for: 'np1' }, h('span', {}, 'New password'), pw),
    h('label', { class: 'field', for: 'np2' }, h('span', {}, 'Type it again'), pw2),
    err, save,
  );
  const s = openSheet({ title: 'Choose a new password', body: form, onClose: () => { recoveryOpen = false; } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pw.value.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
    if (pw.value !== pw2.value) { err.textContent = 'Those don’t match yet.'; return; }
    save.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: pw.value });
    save.disabled = false;
    if (error) { err.textContent = friendlyError(error); return; }
    s.close();
    toast('Password updated. Welcome back!');
  });
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) toastError(error);
}
