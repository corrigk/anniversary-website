// Theme system: <html data-theme="...">, saved in localStorage, falling back
// to settings.default_theme. Themes are discovered from css/themes.css, so a
// new theme only needs a new CSS block with --theme-label.

const KEY = 'bh-theme';
const FALLBACK = [
  { id: 'garden', label: 'Garden' },
  { id: 'marian', label: 'Marian' },
  { id: 'candlelight', label: 'Candlelight' },
  { id: 'wildflower', label: 'Wildflower' },
];

let cached;
export function listThemes() {
  if (cached) return cached;
  const found = [];
  try {
    for (const sheet of document.styleSheets) {
      if (!sheet.href || !sheet.href.includes('themes.css')) continue;
      for (const rule of sheet.cssRules) {
        const m = rule.selectorText && rule.selectorText.match(/\[data-theme="?([\w-]+)"?\]/);
        if (!m || found.some((t) => t.id === m[1])) continue;
        const label = rule.style.getPropertyValue('--theme-label').trim().replace(/^["']|["']$/g, '') || m[1];
        found.push({ id: m[1], label });
      }
    }
  } catch { /* cross-origin or not loaded yet */ }
  cached = found.length ? found : FALLBACK;
  return cached;
}

function saved() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'garden';
}

export function applyTheme(id, persist = true) {
  if (!listThemes().some((t) => t.id === id)) id = 'garden';
  document.documentElement.setAttribute('data-theme', id);
  if (persist) { try { localStorage.setItem(KEY, id); } catch { /* private mode */ } }
  const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && color) meta.setAttribute('content', color);
}

// Called after settings load: use the DB default only if the viewer never chose.
export function initTheme(defaultTheme) {
  applyTheme(saved() || defaultTheme || 'garden', false);
}

// Read a theme's colours without switching to it (for the picker swatches).
export function themePreview(id) {
  const out = {};
  try {
    for (const sheet of document.styleSheets) {
      if (!sheet.href || !sheet.href.includes('themes.css')) continue;
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && rule.selectorText.includes(`"${id}"`)) {
          for (const k of ['--bg', '--surface', '--accent', '--accent-2', '--text', '--motif-color', '--font-head']) {
            out[k] = rule.style.getPropertyValue(k).trim();
          }
        }
      }
    }
  } catch { /* ignore */ }
  return out;
}
