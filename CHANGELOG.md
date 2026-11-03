# Changelog

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
