# Bubs & Honies

A private little website for two: a timeline of memories, "open when…" letters,
songs, puzzles, a bucket list, reasons, coupons and countdowns. Plain HTML, CSS and
ES modules (no build step), hosted on GitHub Pages, with Supabase for login,
data and photos.

> **This repo is public.** It holds no personal content. Everything real (photos,
> letters, puzzle answers, names, dates) lives in Supabase behind Row Level Security.
> The publishable (anon) key in `js/config.js` is safe to publish **only because of
> RLS**. Never put the `service_role` / secret key anywhere in this repo.

---

## Setup (do these in order)

1. **Create a Supabase project** (free tier). Save the database password somewhere safe.
2. **Authentication → Sign In / Providers → Email:** keep it enabled.
   Turn **off** "Allow new users to sign up".
   Under **Authentication → URL Configuration**, set **Site URL** to
   `https://corrigk.github.io/anniversary-website/` and add the same URL (plus
   `http://localhost:8080/` for local testing) to **Redirect URLs**. This makes
   "Forgot password?" emails work.
3. **Authentication → Users → Add user → Create new user:** make two users
   (Bubs and Honies) with email + password, and tick **Auto Confirm User**.
4. **SQL editor:** run these files in order (paste the file in and click Run):
   1. `supabase/schema.sql`
   2. `supabase/policies.sql`
   3. `supabase/members.sql`: your **private** copy of `members.example.sql`
      (gitignored). Paste in the two **User UID**s (Authentication → Users → click a
      user). It looks like this:
      ```sql
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
      on conflict (key) do update set value = excluded.value;
      ```
   4. `supabase/seed_placeholders.sql` (optional draft content)
5. **Storage:** check that a **private** bucket named `memories` exists (the SQL
   creates it) and that it has four policies under Storage → Policies. If the SQL
   editor refused to create storage policies, add them in the dashboard: one each for
   SELECT/INSERT/UPDATE/DELETE on bucket `memories`, for `authenticated`, with the
   expression `bucket_id = 'memories' and public.is_member()`.
6. **Project Settings → API Keys:** the Project URL and the **publishable** key are
   already in `js/config.js`. If you ever rotate the key, update it there. **Never**
   copy the secret / `service_role` key.
7. **GitHub:** push to `main`, then go to **Settings → Pages → Deploy from a branch →
   `main` / root**. The site will be at `https://corrigk.github.io/anniversary-website/`.
   Make sure that URL is in Supabase's redirect URLs (step 2).
8. **Run the outsider test** (below). It must pass.
9. **Free-tier note:** Supabase pauses projects after about a week with no activity.
   Open the site every few days, and **check it's awake on Nov 10–11**. A paused
   project is restored from the Supabase dashboard.

## Outsider test (run after setup, and after any SQL change)

This pretends to be a stranger who has the public key but no login:

```bash
python scripts/outsider_test.py
```

Every line must say `PASS`: all 15 tables, writes, both RPCs and the storage bucket
return nothing or an error. If every table shows HTTP 404, the SQL hasn't been run
yet, so the pass doesn't mean anything.

Manual double-check: open the site in a private window. You should see only the
login screen, and `https://corrigk.github.io/anniversary-website/#/timeline` should
still show only the login screen.

## Running locally

```bash
python scripts/dev_server.py 8080
```

Then open http://localhost:8080/. ES modules need a server; opening `index.html` as
a file won't work. This little server turns off browser caching so you always see
your latest edits. (On GitHub Pages, changes can take up to ~10 minutes to show
because Pages caches files.)

---

## How things work

| Piece | Where |
|---|---|
| Router, login flow, app shell, theme picker | `js/app.js` |
| One file per page | `js/pages/*.js` |
| DOM helpers, sheets, toasts, forms (no `innerHTML` with user data) | `js/ui.js` |
| Profiles, settings, CRUD helpers | `js/data.js` |
| Signed URLs, upload, delete | `js/storage.js` |
| Photo resize/re-encode before upload | `js/image.js` |
| Themes (one CSS block each) | `css/themes.css` |
| Everything else visual | `css/base.css` |

- **Photos:** resized in the browser to a max of 1600px (JPEG ~0.8, usually
  200–450 KB) plus a 480px thumbnail, then uploaded to the private bucket as
  `{memory_id}/{uuid}.jpg` and `{memory_id}/{uuid}_thumb.jpg`. They are shown only
  through signed URLs (valid 1 hour, cached ~55 min). Re-encoding also strips
  EXIF/GPS data. Deleting a memory deletes its files.
- **Puzzles:** prompts, hints and rewards are in the `puzzles` table. Answers are in
  `puzzle_answers`, which has RLS on and **no policies**, so the browser can't read
  them. Guesses go to the `check_puzzle()` RPC, which only answers true/false.
- **Finale hook:** `get_finale()` returns the `finale` table's content only after
  `settings.finale_unlock_at`. The `#/finale` page shows a countdown, then a plain
  reveal of `content.title` / `content.message`. The real finale is still TBD.

### Puzzles: setting answers

Answers never go in the code. Set them in the SQL editor:

```sql
-- change an answer (several accepted answers separated by |)
update public.puzzle_answers set answer = 'garden|the garden'
where puzzle_id = (select id from public.puzzles where title = 'Unscramble me');

-- give a puzzle made in the app its answer
insert into public.puzzle_answers (puzzle_id, answer)
select id, 'the answer' from public.puzzles where title = 'My new puzzle'
on conflict (puzzle_id) do update set answer = excluded.answer;
```

Matching ignores case, extra spaces and leading/trailing spaces. For **date-lock**
puzzles (answer box = "Date picker"), store the answer as `YYYY-MM-DD`.

### Finale: setting it up later

```sql
insert into public.settings (key, value) values ('finale_unlock_at', '"2026-11-11T21:00:00-05:00"')
on conflict (key) do update set value = excluded.value;

insert into public.finale (content) values ('{"title": "…", "message": "…"}');
```

A "A surprise" tile appears on Home once `finale_unlock_at` exists.

### Removing placeholder content

Open **`#/admin`** (it isn't linked anywhere; type it after the site URL). It shows how
many placeholder rows each section has, with a **Remove** button per section and one
for everything. It also deletes any files attached to those rows. The same SQL is at
the bottom of `supabase/seed_placeholders.sql`.

Editing a placeholder in the app turns it into real content (`is_placeholder = false`),
so the cleanup won't delete anything you've rewritten. Checking off a bucket item or
redeeming a coupon does **not** count as editing it.

`#/admin` also has **Mark every letter unopened** and **Reset my puzzle progress**,
which are handy after testing.

### The magic layer

`js/magic.js` adds:

- **Ambient light** behind every page, different per theme: fireflies (Garden),
  twinkling stars with the odd shooting star (Marian), rising candle embers
  (Candlelight), floating pollen (Wildflower). Set by `--magic-kind` and
  `--magic-rgb` / `--magic-rgb-2` in each theme block.
- **Tap sparkles:** a tiny burst wherever you tap.
- **Celebrations:** hearts, petals and stars burst out when you redeem a coupon,
  solve a puzzle, check off a bucket item, open a letter, add a memory, and on the
  anniversary itself. Android phones also get a tiny buzz.
- **Little motion:** page sections drift in one by one, the days counter shimmers
  like gold leaf, the header sprout sways, the active tab hops.

`js/intro.js` is the **first-open welcome**: a wreath draws itself, leaves unfurl,
and the theme's emblem appears with "For you, {name}" and an **Open it ♡** button.
On the anniversary it says "Happy 3rd anniversary". It shows once per person per
device; replay it from **More → Replay the welcome**.

Everything turns off for phones with "Reduce motion" on, and anyone can switch the
particles off in **More → Sparkles & fireflies**.

### Themes

Four themes: **Garden** (default), **Marian**, **Candlelight**, **Wildflower**. Tap
🎨 in the header, on the login screen, or in More → Change the look. A small dock
opens without covering the page: tap a swatch or use ‹ › (or the arrow keys) to flip
through them live. The choice is saved per device in `localStorage`. The fallback is `settings.default_theme`:

```sql
update public.settings set value = '"marian"' where key = 'default_theme';
```

To **add a theme**, copy a block in `css/themes.css`, change the `data-theme` id and
`--theme-label`, and adjust the values. The picker finds it automatically.

All four themes pass WCAG AA for text (body text ≥ 11:1; muted text, links, buttons
and accent text ≥ 4.9:1).

### Decorative Catholic touches (easy to change)

Each one is marked `CATHOLIC TOUCH` in the code:

| Touch | Where | To remove |
|---|---|---|
| Rosary-bead divider | Candlelight theme, `--motif-divider` in `css/themes.css` | Swap in another theme's divider SVG |
| Tiny cross in the centre of dividers | Candlelight theme, `--motif-divider-center` | Set it to `var(--motif-sprig)` |
| Small rose in the centre of dividers | Marian theme, `--motif-divider-center` | Set it to `var(--motif-sprig)` |
| "Ad multos annos ♡" flourish on the anniversary day | `js/pages/home.js`, celebration state | Delete that one line |
| Placeholder content: "Go to a Mass…", "Open when you want to pray together", "Your faith is quietly beautiful." | `supabase/seed_placeholders.sql` | Edit or delete in the app |

Flowers, leaves and vines (sprout, stars, rosebuds, wildflowers, drifting petals,
the growing vine on login and the plant on Stats) are all inline SVG, with no image
files. Animations switch off when the phone has "Reduce motion" turned on.

---

## Decisions made along the way (sensible defaults)

- **Letters are marked opened** only when someone *other than the author* opens one,
  so previewing your own letters doesn't spoil them. Reset via `#/admin`.
- **Puzzles unlock in order:** the next one opens after the previous is solved. Hints
  are unlimited. Progress is per person.
- **Puzzle table additions:** `image_path` (for photo-detail puzzles) and `input_type`
  (`text` or `date`). Puzzle pictures are stored at `puzzles/{puzzle_id}/…`.
- **Puzzle answers can't be set from the app**, only from the SQL editor, so they
  stay completely out of the browser. (A write-only "set answer" RPC would be easy to
  add later if that's annoying.)
- **Thumbnails are 480px**, not 400px, so photos stay sharp on high-density phone screens.
- **Relationship start date** is not in the repo. It lives only in `settings`
  (via your private `members.sql`).
- **Password reset** uses Supabase's implicit flow, so the email link works even if
  it's opened in a different browser than the one that asked for it.
- `index.html` has `noindex, nofollow` so search engines leave the site alone.
- **One dependency:** `@supabase/supabase-js@2.118.0` from jsDelivr (pinned). Fonts
  come from Google Fonts with `display=swap`.

## Phase 3 (after Nov 11)

Photo map: `memories.lat` / `lng` already exist (null for now). The plan is to
geocode `location_text` with OpenStreetMap Nominatim (one request per save, with a
proper User-Agent/referrer per its usage policy) and show a Leaflet map with OSM tiles.
