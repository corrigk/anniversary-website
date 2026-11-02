-- =====================================================================
-- Bubs & Honies — placeholder (draft) content
-- Run 4th, after members.sql (so "added by Bubs" works).
-- Every row here has is_placeholder = true. Remove them any time from the
-- hidden #/admin page, or with the SQL at the bottom of this file.
-- Editing a placeholder in the app turns it into real content (is_placeholder
-- becomes false), so it survives the cleanup.
-- =====================================================================

do $$
declare
  bubs uuid := (select id from public.profiles where display_name = 'Bubs' limit 1);
  p1 uuid; p2 uuid; p3 uuid;
begin

insert into public.letters (created_by, is_placeholder, label, body) values
  (bubs, true, 'Open when you miss me',            'A placeholder letter. Write something warm here.'),
  (bubs, true, 'Open when you''re stressed',        'A placeholder letter. Breathe in, breathe out.'),
  (bubs, true, 'Open when you need a laugh',        'A placeholder letter. Put your best joke here.'),
  (bubs, true, 'Open when you can''t sleep',        'A placeholder letter. Something soft and quiet.'),
  (bubs, true, 'Open when you''re feeling doubtful','A placeholder letter. Something steady and true.'),
  (bubs, true, 'Open when we''ve had a disagreement','A placeholder letter. Something kind to come back to.'),
  (bubs, true, 'Open when you''ve had a great day', 'A placeholder letter. Celebrate with me.'),
  (bubs, true, 'Open when you want to pray together','A placeholder letter. A short prayer could go here.'),
  (bubs, true, 'Open when it''s your birthday',     'A placeholder letter. Happy birthday!');

insert into public.reasons (created_by, is_placeholder, text) values
  (bubs, true, 'You make ordinary days feel like favorites.'),
  (bubs, true, 'You laugh with your whole self.'),
  (bubs, true, 'You''re kind to people when no one''s watching.'),
  (bubs, true, 'You make me want to be better.'),
  (bubs, true, 'Home feels like wherever you are.'),
  (bubs, true, 'You remember the small things.'),
  (bubs, true, 'Your faith is quietly beautiful.'),
  (bubs, true, 'You make the hard days lighter.'),
  (bubs, true, 'You notice the flowers on every walk.'),
  (bubs, true, 'You''re my favorite person to do nothing with.');

insert into public.coupons (created_by, is_placeholder, title, description) values
  (bubs, true, 'One long back rub',               'Redeemable any evening.'),
  (bubs, true, 'You pick the movie, no vetoes',   'Even that one.'),
  (bubs, true, 'Dinner cooked by me',             'Your pick of the menu.'),
  (bubs, true, 'A walk anywhere you like',        'Snacks included.'),
  (bubs, true, 'Breakfast in bed',                'Coffee the way you like it.'),
  (bubs, true, 'Coffee run, my treat',            'Any size, any day.'),
  (bubs, true, 'One free ''I was wrong''',         'No questions asked.'),
  (bubs, true, 'A day of doing whatever you want','I''ll plan nothing and follow you.');

insert into public.bucket_items (created_by, is_placeholder, text) values
  (bubs, true, 'Take a road trip with no plan'),
  (bubs, true, 'Plant a garden together'),
  (bubs, true, 'Go to a Mass somewhere we''ve never been'),
  (bubs, true, 'Cook a new recipe every month for a year'),
  (bubs, true, 'See a sunrise together'),
  (bubs, true, 'Visit a new state'),
  (bubs, true, 'Learn a dance'),
  (bubs, true, 'Write letters to our future selves');

insert into public.memories (created_by, is_placeholder, happened_on, title, caption, location_text) values
  (bubs, true, '2024-01-01', 'The day we met',         'A placeholder memory. Replace with the real story.', 'Somewhere special'),
  (bubs, true, '2023-12-02', 'Our first date',          'A placeholder memory. What did we eat? What did we laugh about?', 'A cozy little place'),
  (bubs, true, '2024-06-15', 'A favorite ordinary day', 'A placeholder memory. Nothing big happened, and it was perfect.', 'Home');

-- Puzzles. Answers are OBVIOUSLY FAKE — change them (see bottom of file).
--   1 "The day it all began"  answer: 1999-01-01
--   2 "Free text"             answer: sunflower | sunflowers
--   3 "Scramble"              answer: garden
insert into public.puzzles (created_by, is_placeholder, position, title, prompt, hint, reward_text, input_type)
values (bubs, true, 1, 'The day it all began',
        'Enter the date where our story starts.',
        'Think back to the very first page of the timeline.',
        'You remembered! (Placeholder reward — write something sweet here.)', 'date')
returning id into p1;

insert into public.puzzles (created_by, is_placeholder, position, title, prompt, hint, reward_text, input_type)
values (bubs, true, 2, 'A little riddle',
        'I turn my face to follow the sun. What flower am I?',
        'Tall, yellow, and full of seeds.',
        'Correct! (Placeholder reward.)', 'text')
returning id into p2;

insert into public.puzzles (created_by, is_placeholder, position, title, prompt, hint, reward_text, input_type)
values (bubs, true, 3, 'Unscramble me',
        'N E D R A G',
        'It is where things grow.',
        'You did it! (Placeholder reward.)', 'text')
returning id into p3;

insert into public.puzzle_answers (puzzle_id, answer) values
  (p1, '1999-01-01'),
  (p2, 'sunflower|sunflowers'),
  (p3, 'garden');

end $$;

-- ---------------------------------------------------------------------
-- Changing a puzzle answer (run in the SQL editor):
--   update public.puzzle_answers set answer = 'new answer|other spelling'
--   where puzzle_id = (select id from public.puzzles where title = 'Unscramble me');
--
-- Adding an answer for a puzzle created in the app:
--   insert into public.puzzle_answers (puzzle_id, answer)
--   select id, 'the answer' from public.puzzles where title = 'My new puzzle'
--   on conflict (puzzle_id) do update set answer = excluded.answer;
--
-- Removing ALL placeholder content at once (same as the #/admin buttons):
--   delete from public.memories     where is_placeholder;
--   delete from public.letters      where is_placeholder;
--   delete from public.reasons      where is_placeholder;
--   delete from public.coupons      where is_placeholder;
--   delete from public.bucket_items where is_placeholder;
--   delete from public.songs        where is_placeholder;
--   delete from public.countdowns   where is_placeholder;
--   delete from public.puzzles      where is_placeholder;  -- answers cascade
-- ---------------------------------------------------------------------
