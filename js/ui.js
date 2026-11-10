// Small DOM toolkit. All user text goes through text nodes / textContent,
// never innerHTML, so nothing typed into the site can inject markup.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string' && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// SVG element builder: s('circle', { cx: 5, cy: 5, r: 2 }).
const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// A small, stable pseudo-random number in [0, 1) from any string (so a
// memory's flower or star looks the same every visit).
export function seeded(str, salt = 0) {
  let x = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 13; x = Math.imul(x, 0x5bd1e995); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// Parse a TRUSTED, hard-coded SVG/HTML string (never user data).
export function trusted(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const sprig = (cls = '') => h('span', { class: `sprig ${cls}`.trim(), 'aria-hidden': 'true' });
export const divider = () => h('div', { class: 'divider', 'aria-hidden': 'true' });

// ---------- toasts ----------
export function toast(message, type = 'info', ms = 3200) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  box.append(t);
  setTimeout(() => t.remove(), type === 'error' ? ms + 2500 : ms);
}
// A toast with a button, for things worth acting on ("Open it").
export function toastAction(message, label, onClick, ms = 14000) {
  const box = document.getElementById('toasts');
  const btn = h('button', { class: 'btn small', type: 'button', text: label });
  const t = h('div', { class: 'toast action', role: 'status' }, h('span', {}, message), btn);
  btn.addEventListener('click', () => { t.remove(); onClick(); });
  box.append(t);
  setTimeout(() => t.remove(), ms);
}
export const toastError = (err) => {
  console.warn(err);
  toast(err?.message || String(err), 'error');
};

// ---------- scroll lock (shared by sheets, the lightbox and the intro) ----------
let locks = 0;
export function lockScroll() { if (++locks === 1) document.body.style.overflow = 'hidden'; }
export function unlockScroll() { locks = Math.max(0, locks - 1); if (!locks) document.body.style.overflow = ''; }

// Close every open sheet / lightbox (used when the route changes, e.g. the
// phone's back button is pressed while a sheet is open).
const closers = new Set();
export function closeOverlays() {
  [...closers].forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  closers.clear();
  locks = 0;
  document.body.style.overflow = '';
}
export function registerOverlay(closeFn) { closers.add(closeFn); return () => closers.delete(closeFn); }

// ---------- sheets / dialogs ----------

export function openSheet({ title, body, footer, onClose, dialog = false, label }) {
  const prevFocus = document.activeElement;
  const titleId = `sheet-title-${Math.random().toString(36).slice(2)}`;
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', text: '✕' });
  const sheet = h('div', {
    class: `sheet${dialog ? ' dialog' : ''}`,
    role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': title ? titleId : null, 'aria-label': title ? null : label,
  },
    dialog ? null : h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    title ? h('div', { class: 'sheet-head' }, h('h2', { id: titleId }, title), closeBtn) : null,
    h('div', { class: 'sheet-body' }, body),
    footer ? h('div', { class: 'sheet-foot' }, footer) : null,
  );
  const backdrop = h('div', { class: `sheet-backdrop${dialog ? ' centered' : ''}` }, sheet);
  let closed = false;

  function close(result) {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    unregister();
    unlockScroll();
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    onClose && onClose(result);
  }
  function onKey(e) {
    if (e.key === 'Escape' && backdrop === [...document.querySelectorAll('.sheet-backdrop')].pop()) {
      e.stopPropagation();
      close();
    }
    if (e.key === 'Tab') trapFocus(e, sheet);
  }
  closeBtn.addEventListener('click', () => close());
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  const unregister = registerOverlay(() => close());
  lockScroll();
  requestAnimationFrame(() => {
    const first = sheet.querySelector('[autofocus], input:not([type=hidden]):not([type=file]), textarea, select');
    // Do not pop the keyboard open on phones for long forms; focus the sheet instead.
    if (first && window.matchMedia('(min-width: 768px)').matches) first.focus();
    else { sheet.tabIndex = -1; sheet.focus({ preventScroll: true }); }
  });
  return { close, sheet };
}

function trapFocus(e, root) {
  const f = [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function confirmDialog(message, { ok = 'Yes', cancel = 'Cancel', danger = false, title = 'Are you sure?' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const okBtn = h('button', { class: `btn ${danger ? 'danger' : ''}`, type: 'button', text: ok });
    const cancelBtn = h('button', { class: 'btn ghost', type: 'button', text: cancel });
    const s = openSheet({
      title, dialog: true,
      body: h('p', {}, message),
      footer: [h('span', { class: 'spacer' }), cancelBtn, okBtn],
      onClose: () => { if (!answered) resolve(false); },
    });
    okBtn.addEventListener('click', () => { answered = true; s.close(); resolve(true); });
    cancelBtn.addEventListener('click', () => { answered = true; s.close(); resolve(false); });
    setTimeout(() => cancelBtn.focus(), 30);
  });
}

// ---------- generic form ----------
// fields: [{ name, label, type, required, placeholder, hint, options, rows, max }]
export function buildForm(fields, initial = {}) {
  const inputs = {};
  const els = fields.map((f) => {
    const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
    const val = initial[f.name] ?? f.default ?? '';
    let input;
    if (f.type === 'textarea') {
      input = h('textarea', { id, name: f.name, rows: f.rows || 5, placeholder: f.placeholder || '', required: !!f.required, maxlength: f.max || null });
      input.value = val ?? '';
    } else if (f.type === 'checkbox') {
      input = h('input', { id, type: 'checkbox', name: f.name });
      input.checked = !!val;
      inputs[f.name] = input;
      return h('label', { class: 'check', for: id }, input, f.label);
    } else if (f.type === 'select') {
      input = h('select', { id, name: f.name }, (f.options || []).map((o) => h('option', { value: o.value }, o.label)));
      input.value = val ?? '';
    } else {
      input = h('input', {
        id, name: f.name, type: f.type || 'text', placeholder: f.placeholder || '', required: !!f.required,
        maxlength: f.max || null, autocomplete: f.autocomplete || 'off', inputmode: f.inputmode || null,
      });
      input.value = val ?? '';
      if (f.suggestions?.length) {
        const listId = `${id}-list`;
        input.setAttribute('list', listId);
        inputs[`__list_${f.name}`] = h('datalist', { id: listId }, f.suggestions.map((s) => h('option', { value: s })));
      }
    }
    inputs[f.name] = input;
    return h('label', { class: 'field', for: id },
      h('span', {}, f.label, f.required ? null : h('span', { class: 'muted small', text: ' (optional)', style: { display: 'inline', fontWeight: 400 } })),
      input,
      inputs[`__list_${f.name}`] || null,
      f.hint ? h('span', { class: 'hint' }, f.hint) : null,
    );
  });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { novalidate: true }, els, error);

  function values() {
    const out = {};
    for (const f of fields) {
      const el = inputs[f.name];
      if (f.type === 'checkbox') out[f.name] = el.checked;
      else {
        const v = el.value.trim();
        out[f.name] = v === '' ? null : v;
      }
    }
    return out;
  }
  function validate() {
    for (const f of fields) {
      const el = inputs[f.name];
      if (f.required && !el.value.trim()) {
        error.textContent = `Please fill in “${f.label}”.`;
        el.focus();
        return false;
      }
      if (f.type === 'url' && el.value.trim() && !/^https?:\/\//i.test(el.value.trim())) {
        error.textContent = 'Links need to start with http:// or https://';
        el.focus();
        return false;
      }
    }
    error.textContent = '';
    return true;
  }
  return { form, inputs, values, validate, error };
}

// Standard add/edit sheet. onSave(values) may throw; the sheet stays open.
export function editSheet({ title, fields, initial = {}, onSave, onDelete, saveText = 'Save', extra }) {
  const f = buildForm(fields, initial);
  if (extra) f.form.insertBefore(extra, f.error);
  const save = h('button', { class: 'btn', type: 'button', text: saveText });
  const del = onDelete ? h('button', { class: 'btn danger small', type: 'button', text: 'Delete' }) : null;
  const cancel = h('button', { class: 'btn ghost', type: 'button', text: 'Cancel' });
  const s = openSheet({ title, body: f.form, footer: [del, h('span', { class: 'spacer' }), cancel, save] });

  let saving = false;
  async function submit(e) {
    e && e.preventDefault();
    if (saving || !f.validate()) return; // Enter pressed twice must not save twice
    saving = true;
    save.disabled = true;
    const label = save.textContent;
    save.textContent = 'Saving…';
    try {
      await onSave(f.values(), { ...f, progress: (t) => { save.textContent = t; } });
      s.close('saved');
    } catch (err) {
      f.error.textContent = err.message || String(err);
      toastError(err);
    } finally {
      saving = false;
      save.disabled = false;
      save.textContent = label;
    }
  }
  f.form.addEventListener('submit', submit);
  save.addEventListener('click', submit);
  cancel.addEventListener('click', () => s.close());
  del && del.addEventListener('click', async () => {
    if (!(await confirmDialog('This will be deleted for both of you. This cannot be undone.', { ok: 'Delete', danger: true }))) return;
    del.disabled = true;
    try { await onDelete(); s.close('deleted'); }
    catch (err) { toastError(err); del.disabled = false; }
  });
  return { ...s, form: f };
}

// ---------- page bits ----------
export function pageHead(title, sub, onAdd, addLabel = '+ Add') {
  return h('header', { class: 'page-head' },
    h('div', { class: 'grow' }, h('h1', {}, title), sub ? h('p', { class: 'sub' }, sub) : null),
    onAdd ? h('button', { class: 'btn', type: 'button', onclick: onAdd, text: addLabel }) : null,
  );
}

export function empty(text, actionLabel, onAction) {
  return h('div', { class: 'empty' },
    sprig(),
    h('p', { style: { margin: 0 } }, text),
    actionLabel ? h('button', { class: 'btn', type: 'button', onclick: onAction, text: actionLabel }) : null,
  );
}

export function loading(text = 'Gathering things…') {
  return h('div', { class: 'loading', role: 'status' }, sprig(), h('span', {}, text));
}

export function iconBtn(label, glyph, onclick) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, text: glyph });
}

export function petals(count = 12) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return h('div', { hidden: true });
  const wrap = h('div', { class: 'petals', 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    const size = 10 + Math.random() * 12;
    wrap.append(h('i', {
      style: {
        left: `${Math.random() * 100}%`,
        width: `${size}px`, height: `${size}px`,
        animationDuration: `${14 + Math.random() * 14}s`,
        animationDelay: `${-Math.random() * 24}s`,
      },
    }));
  }
  return wrap;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Animate a number counting up inside el.
export function countUp(el, target, { duration = 1200, format = (n) => n.toLocaleString() } = {}) {
  if (prefersReducedMotion() || target <= 0) { el.textContent = format(target); return; }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
