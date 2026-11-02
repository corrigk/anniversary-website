-- =====================================================================
-- Bubs & Honies — schema
-- Run 1st in the Supabase SQL editor. Safe to re-run (idempotent).
-- Contains NO personal content: real values go in members.sql (gitignored).
-- =====================================================================

-- Keeps updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- People and settings
-- ---------------------------------------------------------------------
create table if not exists public.couple_members (
  user_id    uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  nickname     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Content tables (all share: id, created_by, created_at, updated_at,
-- is_placeholder)
-- ---------------------------------------------------------------------
create table if not exists public.memories (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  happened_on    date not null,
  title          text not null,
  caption        text,
  location_text  text,
  lat            double precision,   -- Phase 3 (photo map)
  lng            double precision    -- Phase 3 (photo map)
);
create index if not exists memories_happened_on_idx on public.memories (happened_on desc);

create table if not exists public.memory_photos (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  memory_id      uuid not null references public.memories on delete cascade,
  storage_path   text not null,
  thumb_path     text,
  sort_order     int not null default 0
);
create index if not exists memory_photos_memory_idx on public.memory_photos (memory_id, sort_order);

create table if not exists public.songs (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  title          text not null,
  artist         text,
  category       text,
  note           text,
  url            text
);

create table if not exists public.letters (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  label          text not null,       -- the "Open when..." text
  body           text,
  audio_path     text,
  opened_at      timestamptz
);

create table if not exists public.reasons (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  text           text not null
);

create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  title          text not null,
  description    text,
  redeemed       boolean not null default false,
  redeemed_at    timestamptz
);

create table if not exists public.bucket_items (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  text           text not null,
  done           boolean not null default false,
  done_on        date
);

create table if not exists public.countdowns (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  title          text not null,
  event_date     date not null,
  emoji          text
);

-- Puzzles. image_path and input_type are small additions to the spec so the
-- UI can show a photo-detail image and a date picker for "date lock" puzzles.
create table if not exists public.puzzles (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  is_placeholder boolean not null default false,
  position       int not null default 0,
  title          text not null,
  prompt         text,
  hint           text,
  reward_text    text,
  image_path     text,
  input_type     text not null default 'text' check (input_type in ('text', 'date'))
);

-- Answers: RLS on, NO policies -> unreadable from the client.
-- Several accepted answers can be separated by "|".
create table if not exists public.puzzle_answers (
  puzzle_id uuid primary key references public.puzzles on delete cascade,
  answer    text not null
);

create table if not exists public.puzzle_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  puzzle_id  uuid not null references public.puzzles on delete cascade,
  solved_at  timestamptz not null default now(),
  unique (user_id, puzzle_id)
);

-- Finale: RLS on, NO policies -> only readable through get_finale().
create table if not exists public.finale (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content    jsonb
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','settings','memories','memory_photos','songs','letters','reasons',
    'coupons','bucket_items','countdowns','puzzles','finale'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Non-personal defaults. relationship_start lives in members.sql.
insert into public.settings (key, value) values
  ('default_theme', '"garden"')
on conflict (key) do nothing;
