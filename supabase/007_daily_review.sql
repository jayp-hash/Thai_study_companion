-- =====================================================================
-- 007: Daily review, streaks and learning goal
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- When each word is next due, and when it was first studied
-- (to count new words per day).
alter table word_progress
  add column if not exists due timestamptz,
  add column if not exists introduced_at timestamptz;

-- Learning goal: how many new words a day (default 10)
alter table profiles
  add column if not exists new_per_day integer not null default 10;

-- One row per person per day they studied. "done" = finished the daily
-- review; the streak counts days in a row that are done.
create table if not exists study_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  reviewed integer not null default 0,
  done boolean not null default false,
  primary key (user_id, day)
);

alter table study_days enable row level security;
drop policy if exists "own days" on study_days;
create policy "own days" on study_days
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
