-- =====================================================================
-- Bubs & Honies — photo framing
-- Lets you choose what stays in view when the timeline crops a photo.
-- Two optional columns (0 to 1; empty means centred). Safe to re-run.
-- The site works without this; framing just can't be saved until it's run.
-- =====================================================================
alter table public.memory_photos add column if not exists focus_x real;
alter table public.memory_photos add column if not exists focus_y real;

-- Ask the API to notice the new columns right away.
notify pgrst, 'reload schema';
