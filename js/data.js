// Shared app state: the signed-in user, both profiles and the settings table.
import { supabase, q } from './supabase.js';
import { h } from './ui.js';
import { parseDate } from './dates.js';

export const state = {
  user: null,
  profiles: new Map(), // id -> profile
  settings: {},        // key -> value (jsonb already parsed)
};

export async function loadShared() {
  const [profiles, settings] = await Promise.all([
    q(supabase.from('profiles').select('id, display_name, nickname')),
    q(supabase.from('settings').select('key, value')),
  ]);
  state.profiles = new Map(profiles.map((p) => [p.id, p]));
  state.settings = Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

export const me = () => state.profiles.get(state.user?.id);
export const myName = () => me()?.display_name || 'love';
export const nameOf = (id) => state.profiles.get(id)?.display_name || null;
export const isMine = (row) => row?.created_by && row.created_by === state.user?.id;

export function startDate() {
  return parseDate(state.settings.relationship_start);
}

export function authorBadge(createdBy) {
  const n = nameOf(createdBy);
  return n ? h('span', { class: 'badge' }, h('span', { class: 'sprig', 'aria-hidden': 'true', style: { width: '1em', height: '1em' } }), `added by ${n}`) : null;
}

// Basic CRUD helpers. Any edit made in the app turns a placeholder into real content.
export const db = {
  list: (table, build = (x) => x) => q(build(supabase.from(table).select('*'))),
  insert: async (table, row) => q(supabase.from(table).insert(row).select().single()),
  update: async (table, id, patch) => q(supabase.from(table).update({ ...patch, is_placeholder: false }).eq('id', id).select().single()),
  patch: async (table, id, patch) => q(supabase.from(table).update(patch).eq('id', id).select().single()),
  remove: async (table, id) => q(supabase.from(table).delete().eq('id', id)),
  count: async (table, build = (x) => x) => {
    const { count, error } = await build(supabase.from(table).select('id', { count: 'exact', head: true }));
    if (error) throw new Error(error.message);
    return count || 0;
  },
};
