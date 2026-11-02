// Finale hook. The real finale design is still TBD; this page only shows a
// locked countdown or, once get_finale() unlocks, a simple placeholder reveal
// of content.title / content.message.
import { h, pageHead, empty, loading, sprig, petals, toastError } from '../ui.js';
import { supabase, friendlyError } from '../supabase.js';

export async function render(root) {
  root.append(pageHead('A surprise'));
  const box = h('div');
  root.append(box);
  let timer = null;

  async function load() {
    box.replaceChildren(loading('Peeking…'));
    const { data, error } = await supabase.rpc('get_finale');
    if (error) { toastError(new Error(friendlyError(error))); box.replaceChildren(empty('Couldn’t check on the surprise.', 'Try again', load)); return; }
    if (!data || (!data.unlocked && data.seconds_remaining === null)) {
      box.replaceChildren(empty('Nothing to see here… yet. 🌱'));
      return;
    }
    if (!data.unlocked) {
      let left = data.seconds_remaining;
      const clock = h('div', { class: 'big', role: 'timer' });
      const tick = () => {
        if (left <= 0) { clearInterval(timer); load(); return; }
        const hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
        clock.textContent = `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        left--;
      };
      tick();
      timer = setInterval(tick, 1000);
      box.replaceChildren(h('section', { class: 'card hero' }, sprig(), h('p', { class: 'label' }, 'Something is waiting for you in'), clock, h('p', { class: 'muted small' }, 'Come back when the timer runs out.')));
      return;
    }
    const c = data.content || {};
    box.replaceChildren(petals(20), h('section', { class: 'card hero' },
      sprig(), h('h2', {}, c.title || 'Surprise!'), c.message ? h('p', { class: 'pre' }, c.message) : null));
  }
  await load();
  return () => clearInterval(timer);
}
