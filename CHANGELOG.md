# Changelog

## 2026-11-10 (later)

- Photo framing: tap a photo in the memory form to choose what stays in view on
  timeline cards (`js/focus.js`, `supabase/photo_focus.sql`).
- Higher photo quality (2560px full copy, 1280px card copy, 4 photos per memory);
  cards and memory pop-ups now show the full copy so older uploads look sharp too.

## 2026-11-10 — the night before

- Secret garden (unlocks on `settings.garden_unlock_on`), Constellation of us,
  timed surprises with live arrival, "On this day" on Home, scratch-off coupons,
  wish jar, generated soft music (off by default), install as an app with an
  offline shell, extra stats cards.
- New SQL: `supabase/extras.sql` (surprises, wishes, `surprises_waiting()`).
- Bulletproofing: read and upload retries, self-renewing photo links, offline banner,
  back button closes sheets, double-save guard, friendlier "not set up yet" messages.

## 2026-11-02 — magic

- Theme dock: flip between looks live without covering the page; also on the login screen.
- Magic layer: per-theme ambient fireflies / stars / embers / pollen, tap sparkles,
  celebration bursts (coupons, puzzles, bucket list, letters, new memories, anniversary).
- First-open welcome intro with a self-drawing wreath ("Replay the welcome" in More).
- Page sections drift in, gold-leaf shimmer on the days counter, swaying header sprout.
- Sparkles on/off toggle in More; all motion respects "Reduce motion".
- A saved login that stops working now returns you to the login screen instead of an error.
- `scripts/dev_server.py`: no-cache local server.

## 2026-11-01 — first build (Phases 1–3 code complete)

- Supabase schema, RLS on every table, `is_member()`, `check_puzzle()`, `get_finale()`,
  private `memories` storage bucket with member-only policies.
- Placeholder seed + `#/admin` cleanup page.
- App shell: hash router, bottom tabs on phones / top nav on desktop, persistent login,
  password reset, four themes (Garden, Marian, Candlelight, Wildflower).
- Pages: Home (greeting, days counter, live anniversary countdown, random reason),
  Timeline (photo upload pipeline, carousel, lightbox, filter, search, paging),
  Letters, Songs, Stats (with growing plant), Puzzles, Bucket list, Countdowns,
  Reasons, Coupons, finale hook.
- `scripts/outsider_test.py` for the "stranger sees nothing" check.
