import { h, pageHead, confirmDialog } from '../ui.js';
import { ROUTES, openThemePicker, signOut } from '../app.js';
import { myName } from '../data.js';

export function render(root) {
  const links = Object.entries(ROUTES).filter(([, r]) => r.nav === 'extra');
  root.append(
    pageHead('More', `Everything else, ${myName()}.`),
    h('section', { class: 'card' }, h('ul', { class: 'menu' }, links.map(([k, r]) => h('li', {},
      h('a', { href: `#/${k}` }, h('span', { class: 'emo', 'aria-hidden': 'true' }, r.emoji), r.title, h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))))),
    h('section', { class: 'card' }, h('ul', { class: 'menu' },
      h('li', {}, h('button', { type: 'button', onclick: openThemePicker }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '🎨'), 'Change the look', h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))),
      h('li', {}, h('button', {
        type: 'button',
        onclick: async () => { if (await confirmDialog('You’ll need your password to come back in.', { ok: 'Sign out', title: 'Sign out?' })) signOut(); },
      }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '👋'), 'Sign out')),
    )),
  );
}
