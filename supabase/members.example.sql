-- =====================================================================
-- Bubs & Honies — the two members + private settings
-- Run 3rd. Copy this file to members.sql (gitignored), fill it in there,
-- and run THAT copy. Never commit real ids or dates.
--
-- User ids: Supabase dashboard -> Authentication -> Users -> click a user
-- -> copy "User UID".
-- =====================================================================

insert into public.couple_members (user_id) values
  ('BUBS-USER-UUID-HERE'),
  ('HONIES-USER-UUID-HERE')
on conflict do nothing;

insert into public.profiles (id, display_name, nickname) values
  ('BUBS-USER-UUID-HERE',   'Bubs',   null),
  ('HONIES-USER-UUID-HERE', 'Honies', null)
on conflict (id) do update set display_name = excluded.display_name;

insert into public.settings (key, value) values
  ('relationship_start', '"YYYY-MM-DD"')
  -- , ('finale_unlock_at', '"2026-11-11T21:00:00-05:00"')
on conflict (key) do update set value = excluded.value;
