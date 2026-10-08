-- =====================================================================
-- 008: "Say it Today" taps, saved to the account
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- One row per person per day they tapped "I said it!" on a real-life line.
-- (Also the best early signal of whether the app changes real life.)
create table if not exists said_it (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  line integer not null,          -- which Say it Today line (1–60)
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table said_it enable row level security;
drop policy if exists "own said_it" on said_it;
create policy "own said_it" on said_it
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
