-- =====================================================================
-- Bubs & Honies — extras: timed surprises and the wish jar
-- Run after schema.sql and policies.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Timed surprises: little notes that unlock at a time the author picks.
-- The other person cannot read a note (not even from the browser's dev
-- tools) until its unlock time: RLS only returns rows that are unlocked
-- or that you wrote yourself.
-- ---------------------------------------------------------------------
create table if not exists public.surprises (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  unlock_at      timestamptz not null,
  emoji          text,
  title          text not null,
  body           text,
  seen_at        timestamptz
);
create index if not exists surprises_unlock_idx on public.surprises (unlock_at);

-- ---------------------------------------------------------------------
-- Wish jar: drop wishes in, draw one out at random.
-- ---------------------------------------------------------------------
create table if not exists public.wishes (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  text           text not null,
  drawn_at       timestamptz,
  granted        boolean not null default false
);

do $$
declare t text;
begin
  foreach t in array array['surprises', 'wishes'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- wishes: full CRUD for members
drop policy if exists wishes_select on public.wishes;
drop policy if exists wishes_insert on public.wishes;
drop policy if exists wishes_update on public.wishes;
drop policy if exists wishes_delete on public.wishes;
create policy wishes_select on public.wishes for select to authenticated using (public.is_member());
create policy wishes_insert on public.wishes for insert to authenticated with check (public.is_member());
create policy wishes_update on public.wishes for update to authenticated using (public.is_member()) with check (public.is_member());
create policy wishes_delete on public.wishes for delete to authenticated using (public.is_member());

-- surprises: you can always see and manage your own; the other person's
-- only once they have unlocked.
drop policy if exists surprises_select on public.surprises;
drop policy if exists surprises_insert on public.surprises;
drop policy if exists surprises_update on public.surprises;
drop policy if exists surprises_delete on public.surprises;
create policy surprises_select on public.surprises for select to authenticated
  using (public.is_member() and (unlock_at <= now() or created_by = auth.uid()));
create policy surprises_insert on public.surprises for insert to authenticated
  with check (public.is_member());
create policy surprises_update on public.surprises for update to authenticated
  using (public.is_member() and (unlock_at <= now() or created_by = auth.uid()))
  with check (public.is_member());
create policy surprises_delete on public.surprises for delete to authenticated
  using (public.is_member() and (unlock_at <= now() or created_by = auth.uid()));

-- How many surprises from the OTHER person are still locked, and when the
-- next one opens. Reveals timing only, never content.
create or replace function public.surprises_waiting()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.is_member() then
    jsonb_build_object(
      'locked', count(*),
      'next_unlock_at', min(unlock_at),
      'seconds_remaining', ceil(extract(epoch from min(unlock_at) - now()))::int
    )
  end
  from surprises
  where unlock_at > now() and created_by is distinct from auth.uid()
$$;

revoke execute on function public.surprises_waiting() from public, anon;
grant execute on function public.surprises_waiting() to authenticated;
