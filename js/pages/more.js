import { h, pageHead, confirmDialog, openSheet } from '../ui.js';
import { ROUTES, openThemePicker, signOut, installPrompt } from '../app.js';
import { soundEnabled, setSound, chime } from '../sound.js';
import { myName } from '../data.js';
import { magicEnabled, setMagic, celebrate } from '../magic.js';
import { showIntro } from '../intro.js';

export function render(root) {
  const links = Object.entries(ROUTES).filter(([, r]) => r.nav === 'extra');
  root.append(
    pageHead('More', `Everything else, ${myName()}.`),
    h('section', { class: 'card' }, h('ul', { class: 'menu' }, links.map(([k, r]) => h('li', {},
      h('a', { href: `#/${k}` }, h('span', { class: 'emo', 'aria-hidden': 'true' }, r.emoji), r.title, h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))))),
    h('section', { class: 'card' }, h('ul', { class: 'menu' },
      h('li', {}, h('button', { type: 'button', onclick: (e) => openThemePicker(e.currentTarget) }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '🎨'), 'Change the look', h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))),
      h('li', {}, sparkleToggle()),
      h('li', {}, soundToggle()),
      installItem(),
      h('li', {}, h('button', { type: 'button', onclick: showIntro }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '💐'), 'Replay the welcome', h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))),
      h('li', {}, h('button', {
        type: 'button',
        onclick: async () => { if (await confirmDialog('You’ll need your password to come back in.', { ok: 'Sign out', title: 'Sign out?' })) signOut(); },
      }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '👋'), 'Sign out')),
    )),
  );
}

function sparkleToggle() {
  const state = h('span', { class: 'chev' });
  const btn = h('button', { type: 'button', role: 'switch' }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '✨'), 'Sparkles & fireflies', state);
  const sync = () => { const on = magicEnabled(); btn.setAttribute('aria-checked', String(on)); state.textContent = on ? 'On' : 'Off'; };
  btn.addEventListener('click', () => { setMagic(!magicEnabled()); sync(); if (magicEnabled()) celebrate(undefined, undefined, { n: 24 }); });
  sync();
  return btn;
}

function soundToggle() {
  const label = h('span', { class: 'chev' });
  const btn = h('button', { type: 'button', role: 'switch' }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '🎶'), 'Soft music', label);
  const sync = () => { const on = soundEnabled(); btn.setAttribute('aria-checked', String(on)); label.textContent = on ? 'On' : 'Off'; };
  btn.addEventListener('click', () => { setSound(!soundEnabled()); sync(); if (soundEnabled()) setTimeout(() => chime('celebrate'), 300); });
  sync();
  return btn;
}

// "Add to Home Screen": a real prompt on Android, instructions on iPhone.
function installItem() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!installPrompt && !isIOS) return null;
  return h('li', {}, h('button', {
    type: 'button',
    onclick: async () => {
      if (installPrompt) { installPrompt.prompt(); return; }
      openSheet({
        title: 'Add to your Home Screen',
        body: h('ol', { class: 'stack', style: { paddingLeft: '1.2rem' } },
          h('li', {}, 'Open this page in Safari.'),
          h('li', {}, 'Tap the Share button (the square with an arrow).'),
          h('li', {}, 'Choose “Add to Home Screen”, then “Add”.'),
          h('li', {}, 'Open it from the new icon and sign in once more. After that it stays signed in.')),
      });
    },
  }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '📲'), 'Add to Home Screen', h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
}
