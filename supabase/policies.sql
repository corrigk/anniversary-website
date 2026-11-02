-- =====================================================================
-- Bubs & Honies — security: is_member(), RLS, RPCs, storage
-- Run 2nd, after schema.sql. Safe to re-run.
-- =====================================================================

-- True only for the two people listed in couple_members.
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from couple_members where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- Table privileges: nothing for anon, CRUD for signed-in users (RLS still
-- decides which rows). Secret tables get nothing at all.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.puzzle_answers, public.finale from authenticated;

-- ---------------------------------------------------------------------
-- RLS on every table
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'couple_members','profiles','settings','memories','memory_photos','songs',
    'letters','reasons','coupons','bucket_items','countdowns','puzzles',
    'puzzle_answers','puzzle_progress','finale'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Full CRUD for members on every content table.
do $$
declare t text;
begin
  foreach t in array array[
    'memories','memory_photos','songs','letters','reasons','coupons',
    'bucket_items','countdowns','puzzles'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member())', t || '_delete', t);
  end loop;
end $$;

-- couple_members and settings: read-only for members (write in SQL editor).
drop policy if exists couple_members_select on public.couple_members;
create policy couple_members_select on public.couple_members
  for select to authenticated using (public.is_member());

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (public.is_member());

-- profiles: members can read both and edit (e.g. nickname); rows are added in SQL.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (public.is_member());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- puzzle_progress: read + reset by members; rows are only added by check_puzzle().
drop policy if exists puzzle_progress_select on public.puzzle_progress;
create policy puzzle_progress_select on public.puzzle_progress
  for select to authenticated using (public.is_member());
drop policy if exists puzzle_progress_delete on public.puzzle_progress;
create policy puzzle_progress_delete on public.puzzle_progress
  for delete to authenticated using (public.is_member());

-- puzzle_answers and finale: RLS enabled with NO policies on purpose.

-- ---------------------------------------------------------------------
-- RPC: check a puzzle guess. Returns only true/false.
-- ---------------------------------------------------------------------
create or replace function public.check_puzzle(p_puzzle_id uuid, p_guess text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_answer text;
  v_guess  text := regexp_replace(lower(trim(coalesce(p_guess, ''))), '\s+', ' ', 'g');
  v_ok     boolean := false;
begin
  if not public.is_member() or v_guess = '' then
    return false;
  end if;

  select answer into v_answer from puzzle_answers where puzzle_id = p_puzzle_id;
  if v_answer is null then
    return false;
  end if;

  select exists (
    select 1 from unnest(string_to_array(v_answer, '|')) as a(opt)
    where regexp_replace(lower(trim(a.opt)), '\s+', ' ', 'g') = v_guess
  ) into v_ok;

  if v_ok then
    insert into puzzle_progress (user_id, puzzle_id)
    values (auth.uid(), p_puzzle_id)
    on conflict (user_id, puzzle_id) do nothing;
  end if;

  return v_ok;
end $$;

-- ---------------------------------------------------------------------
-- RPC: the finale. Content only after settings.finale_unlock_at.
-- Returns {unlocked, seconds_remaining, content}.
-- ---------------------------------------------------------------------
create or replace function public.get_finale()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_unlock  timestamptz;
  v_content jsonb;
begin
  if not public.is_member() then
    return null;
  end if;

  select (value #>> '{}')::timestamptz into v_unlock
  from settings where key = 'finale_unlock_at';

  if v_unlock is null then
    return jsonb_build_object('unlocked', false, 'seconds_remaining', null, 'content', null);
  end if;

  if now() < v_unlock then
    return jsonb_build_object(
      'unlocked', false,
      'seconds_remaining', ceil(extract(epoch from v_unlock - now()))::int,
      'content', null);
  end if;

  select content into v_content from finale order by created_at desc limit 1;
  return jsonb_build_object('unlocked', true, 'seconds_remaining', 0, 'content', v_content);
end $$;

revoke execute on function public.is_member() from public, anon;
revoke execute on function public.check_puzzle(uuid, text) from public, anon;
revoke execute on function public.get_finale() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.check_puzzle(uuid, text) to authenticated;
grant execute on function public.get_finale() to authenticated;

-- ---------------------------------------------------------------------
-- Storage: one PRIVATE bucket, members only.
-- Paths: {memory_id}/{uuid}.jpg, {memory_id}/{uuid}_thumb.jpg,
--        letters/{letter_id}/..., puzzles/{puzzle_id}/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('memories', 'memories', false, 26214400)  -- 25 MB cap (voice memos)
on conflict (id) do update set public = false;

drop policy if exists "memories bucket select" on storage.objects;
drop policy if exists "memories bucket insert" on storage.objects;
drop policy if exists "memories bucket update" on storage.objects;
drop policy if exists "memories bucket delete" on storage.objects;

create policy "memories bucket select" on storage.objects
  for select to authenticated using (bucket_id = 'memories' and public.is_member());
create policy "memories bucket insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'memories' and public.is_member());
create policy "memories bucket update" on storage.objects
  for update to authenticated
  using (bucket_id = 'memories' and public.is_member())
  with check (bucket_id = 'memories' and public.is_member());
create policy "memories bucket delete" on storage.objects
  for delete to authenticated using (bucket_id = 'memories' and public.is_member());
