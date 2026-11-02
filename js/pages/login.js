import { supabase, friendlyError } from '../supabase.js';
import { h, trusted, petals, toast, divider } from '../ui.js';
import { SITE_TITLE } from '../config.js';

// A vine that grows and unfurls little leaves (decorative, inline SVG).
const VINE = `
<svg class="vine" viewBox="0 0 220 120" aria-hidden="true">
  <path class="grow" d="M10 110 C 40 100, 50 70, 80 72 S 120 100, 140 70 S 170 20, 210 30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  <g fill="currentColor">
    <path class="leaf" style="animation-delay:.5s"  d="M44 92c-10-2-16-10-16-18 9 1 16 8 16 18z"/>
    <path class="leaf" style="animation-delay:.9s"  d="M84 72c2-10 10-16 18-15-1 9-8 15-18 15z"/>
    <path class="leaf" style="animation-delay:1.3s" d="M120 92c-3 10 1 19 9 22 2-9-2-18-9-22z"/>
    <path class="leaf" style="animation-delay:1.7s" d="M150 56c-10-3-15-11-14-19 9 2 15 9 14 19z"/>
    <path class="leaf" style="animation-delay:2.1s" d="M180 33c3-9 11-14 19-12-2 8-10 13-19 12z"/>
    <circle class="leaf" style="animation-delay:2.5s" cx="210" cy="30" r="5"/>
  </g>
</svg>`;

export function render(app) {
  const email = h('input', { id: 'email', type: 'email', autocomplete: 'username', inputmode: 'email', required: true, autocapitalize: 'off', spellcheck: 'false' });
  const password = h('input', { id: 'password', type: 'password', autocomplete: 'current-password', required: true });
  const reveal = h('button', { class: 'btn ghost small reveal', type: 'button', 'aria-pressed': 'false', 'aria-controls': 'password', text: 'Show' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn block', type: 'submit', text: 'Come on in' });
  const forgot = h('button', { class: 'link-btn small', type: 'button', text: 'Forgot password?' });

  reveal.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    reveal.textContent = show ? 'Hide' : 'Show';
    reveal.setAttribute('aria-pressed', String(show));
    reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  const form = h('form', { novalidate: true },
    h('label', { class: 'field', for: 'email' }, h('span', {}, 'Email'), email),
    h('label', { class: 'field', for: 'password' }, h('span', {}, 'Password'),
      h('div', { class: 'pw-wrap' }, password, reveal)),
    err,
    submit,
    h('p', { class: 'fine' }, forgot),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (!email.value.trim() || !password.value) { err.textContent = 'Type your email and password first.'; return; }
    submit.disabled = true;
    submit.textContent = 'Opening the gate…';
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error) {
      submit.disabled = false;
      submit.textContent = 'Come on in';
      err.textContent = /invalid login/i.test(error.message)
        ? 'That email and password didn’t match. Try again?'
        : friendlyError(error);
      return;
    }
    submit.textContent = 'Welcome ♡';
    // app.js takes over on the SIGNED_IN event.
  });

  forgot.addEventListener('click', async () => {
    err.textContent = '';
    const address = email.value.trim();
    if (!address) { err.textContent = 'Type your email above, then tap “Forgot password?” again.'; email.focus(); return; }
    forgot.disabled = true;
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    forgot.disabled = false;
    if (error) { err.textContent = friendlyError(error); return; }
    toast('If that email is ours, a reset link is on its way. 💌', 'info', 6000);
  });

  app.replaceChildren(
    petals(14),
    h('main', { class: 'login' },
      h('div', { class: 'login-card' },
        trusted(VINE),
        h('h1', {}, SITE_TITLE),
        h('p', { class: 'tagline' }, 'A little garden of us, still growing.'),
        h('div', { class: 'card' }, form),
        divider(),
        h('p', { class: 'muted small' }, 'Made with love, one memory at a time.'),
      ),
    ),
  );
}
