import { h, divider, petals, countUp, toastError } from '../ui.js';
import { supabase, q } from '../supabase.js';
import { state, myName, startDate, nameOf } from '../data.js';
import { today, daysBetween, ymd, nextAnniversary, msUntil, ordinal, plural, greeting, formatDate, toISO } from '../dates.js';
import { ROUTES } from '../app.js';
import { celebrate } from '../magic.js';

const TILE_NOTES = {
  timeline: 'Our story so far', letters: 'Open when…', songs: 'Our soundtrack', puzzles: 'A little game',
  reasons: 'Why I love you', coupons: 'Redeem anytime', bucket: 'Someday, together', countdowns: 'Things to look forward to',
  stats: 'Watch us grow',
};

export async function render(root) {
  const start = startDate();
  const timers = [];

  root.append(h('section', { class: 'hello' },
    h('p', { class: 'muted', style: { margin: 0, fontWeight: 600 } }, `${greeting()},`),
    h('h1', {}, `${myName()} `, h('span', { class: 'sprig', 'aria-hidden': 'true' })),
  ));

  if (!start) {
    root.append(h('div', { class: 'card' }, h('p', {}, 'Set relationship_start in the settings table to see our counters. (See README, step 4.)')));
  } else {
    root.append(heroCard(start, timers));
  }

  // Random reason
  const quote = h('p', { class: 'quote' }, '…');
  const by = h('p', { class: 'badge', style: { justifyContent: 'center', display: 'flex' } });
  const shuffle = h('button', { class: 'btn soft small', type: 'button', text: '🔀 Another one' });
  const reasonCard = h('section', { class: 'card reason-card', 'aria-label': 'A reason I love you' },
    h('p', { class: 'muted small', style: { margin: 0, fontWeight: 700 } }, 'A reason I love you'),
    quote, by, shuffle);
  root.append(reasonCard);

  // Tiles
  const tiles = Object.entries(ROUTES).filter(([, r]) => r.nav === 'tab' || r.nav === 'extra').filter(([k]) => k);
  const tileEls = tiles.map(([k, r]) => h('a', { class: 'tile', href: `#/${k}` },
    h('span', { class: 'emo', 'aria-hidden': 'true' }, r.emoji), h('b', {}, r.title), h('span', { class: 'muted' }, TILE_NOTES[k] || '')));
  if (state.settings.finale_unlock_at) {
    tileEls.push(h('a', { class: 'tile', href: '#/finale' }, h('span', { class: 'emo', 'aria-hidden': 'true' }, '🎁'), h('b', {}, 'A surprise'), h('span', { class: 'muted' }, 'Not yet… or is it?')));
  }
  root.append(divider(), h('nav', { class: 'tiles', 'aria-label': 'Sections' }, tileEls));

  // Load reasons for the shuffle card
  let reasons = [];
  let last = -1;
  const showRandom = () => {
    if (!reasons.length) {
      quote.textContent = 'No reasons yet. Add the first one!';
      by.replaceChildren(h('a', { href: '#/reasons' }, 'Add a reason'));
      shuffle.hidden = true;
      return;
    }
    let i = Math.floor(Math.random() * reasons.length);
    if (reasons.length > 1 && i === last) i = (i + 1) % reasons.length;
    last = i;
    quote.classList.add('fading');
    setTimeout(() => {
      quote.textContent = reasons[i].text;
      const n = nameOf(reasons[i].created_by);
      by.textContent = n ? `— ${n}` : '';
      quote.classList.remove('fading');
    }, 180);
  };
  shuffle.addEventListener('click', showRandom);
  try {
    reasons = await q(supabase.from('reasons').select('id, text, created_by'));
    showRandom();
  } catch (err) {
    quote.textContent = 'Couldn’t load reasons right now.';
    toastError(err);
  }

  return () => timers.forEach(clearInterval);
}

function heroCard(start, timers) {
  const now = today();
  const days = Math.max(0, daysBetween(start, now));
  const span = ymd(start, now);
  const ann = nextAnniversary(start, now);
  const card = h('section', { class: 'card hero', 'aria-label': 'Our counters' });

  const big = h('div', { class: 'big' }, '0');
  card.append(
    h('div', { class: 'label' }, 'Together for'),
    big,
    h('div', { class: 'label' }, days === 1 ? 'day' : 'days'),
    h('div', { class: 'breakdown' }, [
      span.years ? plural(span.years, 'year') : null,
      span.months ? plural(span.months, 'month') : null,
      plural(span.days, 'day'),
    ].filter(Boolean).join(', ')),
  );
  countUp(big, days, { duration: 1600 });

  card.append(divider(true));

  if (ann.daysAway === 0 && ann.number > 0) {
    // Celebration state on the day itself
    card.classList.add('celebrate');
    card.append(
      petals(18),
      h('h2', {}, `Happy ${ordinal(ann.number)} anniversary!`),
      h('p', {}, `${plural(ann.number, 'year')} of us. Thank you for every single day.`),
      // CATHOLIC TOUCH: "ad multos annos" (to many more years). Remove this line to drop it.
      h('p', { class: 'flourish' }, 'Ad multos annos ♡'),
    );
    setTimeout(() => celebrate(undefined, undefined, { n: 80 }), 900);
  } else {
    const parts = { d: h('b'), h: h('b'), m: h('b'), s: h('b') };
    const cd = h('div', { class: 'countdown', role: 'timer', 'aria-live': 'off' },
      ['d', 'h', 'm', 's'].map((k) => h('div', {}, parts[k], h('small', {}, { d: 'days', h: 'hrs', m: 'min', s: 'sec' }[k]))));
    const tick = () => {
      const ms = Math.max(0, msUntil(ann.date));
      if (ms === 0) { location.reload(); return; } // midnight on the day: show the celebration
      const s = Math.floor(ms / 1000);
      parts.d.textContent = Math.floor(s / 86400);
      parts.h.textContent = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
      parts.m.textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      parts.s.textContent = String(s % 60).padStart(2, '0');
    };
    tick();
    timers.push(setInterval(tick, 1000));
    card.append(
      h('div', { class: 'label' }, `Until our ${ordinal(ann.number)} anniversary`),
      cd,
      h('div', { class: 'breakdown' }, formatDate(toISO(ann.date), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
    );
  }
  return card;
}
