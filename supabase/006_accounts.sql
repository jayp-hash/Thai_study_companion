-- =====================================================================
-- 006: Accounts (profiles + saved card progress)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- One profile per signed-in person. Supabase keeps the login itself in
-- its own auth.users table; this holds the extra things we want to know.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  persona text,            -- later: 'live' / 'partner' / 'visit' from the welcome questions
  created_at timestamptz not null default now()
);

-- Progress on each word, per person. Same shape the app already keeps in
-- the browser: how many times in a row they pressed "Got it", and when
-- they last saw the card. The daily review queue will be built on this.
create table if not exists word_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  thai text not null,
  got integer not null default 0,
  seen timestamptz not null default now(),
  primary key (user_id, thai)
);

-- Row Level Security: each person can only see and change their own rows.
alter table profiles enable row level security;
alter table word_progress enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own progress" on word_progress;
create policy "own progress" on word_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create the profile automatically the first time someone signs in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
