// Date helpers. Calendar dates ("YYYY-MM-DD") are handled as UTC day numbers
// so daylight-saving changes never shift a count by one.

const DAY = 86400000;

export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

const dayNum = ({ y, m, d }) => Date.UTC(y, m - 1, d) / DAY;

export function today() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

export const todayISO = () => toISO(today());
export const toISO = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Whole days from a to b (b - a).
export function daysBetween(a, b) {
  return Math.round(dayNum(b) - dayNum(a));
}

// { years, months, days } between two calendar dates (a <= b).
export function ymd(a, b) {
  let years = b.y - a.y;
  let months = b.m - a.m;
  let days = b.d - a.d;
  if (days < 0) {
    months--;
    days += new Date(Date.UTC(b.y, b.m - 1, 0)).getUTCDate(); // days in previous month
  }
  if (months < 0) { years--; months += 12; }
  return { years, months, days };
}

// Next occurrence (today counts) of the start date's month/day.
// Feb 29 starts fall back to Feb 28 in non-leap years.
export function nextAnniversary(start, from = today()) {
  const make = (y) => {
    let d = start.d;
    if (start.m === 2 && d === 29 && !isLeap(y)) d = 28;
    return { y, m: start.m, d };
  };
  let cand = make(from.y);
  if (daysBetween(from, cand) < 0) cand = make(from.y + 1);
  return { date: cand, number: cand.y - start.y, daysAway: daysBetween(from, cand) };
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function formatDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const p = parseDate(iso);
  if (!p) return '';
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, opts);
}

export function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function monthName(m, style = 'long') {
  return new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: style });
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

// "in 3 days" / "today" / "5 days ago"
export function relativeDays(iso) {
  const p = parseDate(iso);
  if (!p) return '';
  const n = daysBetween(today(), p);
  if (n === 0) return 'Today!';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${plural(n, 'day')}` : `${plural(-n, 'day')} ago`;
}

// Milliseconds until local midnight at the start of a calendar date.
export function msUntil(p) {
  return new Date(p.y, p.m - 1, p.d).getTime() - Date.now();
}

export function greeting(d = new Date()) {
  const hr = d.getHours();
  if (hr < 5) return 'Hello, night owl';
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}
