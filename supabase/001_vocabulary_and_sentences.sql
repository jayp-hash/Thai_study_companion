-- =====================================================================
-- 001: Vocabulary + sample sentences
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once (it only creates things that don't exist).
-- =====================================================================

-- 1) VOCABULARY — one row per word (from the workbook's Vocabulary tab)
create table if not exists vocabulary (
  id              bigint generated always as identity primary key,  -- auto-numbered row ID
  thai            text not null unique,      -- the word itself; "unique" = no duplicates allowed
  romanization    text not null,
  english         text not null,
  frequency_rank  numeric,                   -- average rank across sources (lower = more common); empty for added words
  sources_count   int not null default 0,    -- how many of the 3 frequency lists include this word
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2) SENTENCES — one row per example sentence
create table if not exists sentences (
  id              bigint generated always as identity primary key,
  thai            text not null unique,
  romanization    text,
  english         text,
  category        text,                      -- e.g. Greetings, Shopping, or a grammar pattern name
  sentence_type   text check (sentence_type in ('Statement', 'Question')),  -- needed to pick ค่ะ vs คะ
  source          text not null,             -- where it came from: 'Sentence Patterns tab', 'Sentence Structures tab', 'Claude draft'
  review_status   text not null default 'unreviewed'
                  check (review_status in ('unreviewed', 'needs_native_review', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3) WORD_SENTENCES — the link table: "word X appears in sentence Y"
--    One sentence contains many words; one word appears in many sentences
--    (a "many-to-many" relationship), so the links live in their own table.
create table if not exists word_sentences (
  word_id      bigint not null references vocabulary(id) on delete cascade,
  sentence_id  bigint not null references sentences(id)  on delete cascade,
  primary key (word_id, sentence_id)        -- the same link can't be stored twice
);

-- Index = a lookup shortcut, so "all sentences for this word" stays fast
create index if not exists word_sentences_sentence_idx on word_sentences (sentence_id);

-- 4) SECURITY (Row Level Security)
-- Turn on RLS so nothing is readable/writable by default, then allow
-- everyone (including logged-out visitors) to READ. Nobody can WRITE from
-- the website; only the import script can, using the secret service-role key.
alter table vocabulary     enable row level security;
alter table sentences      enable row level security;
alter table word_sentences enable row level security;

drop policy if exists "Public can read vocabulary" on vocabulary;
create policy "Public can read vocabulary" on vocabulary for select using (true);

drop policy if exists "Public can read sentences" on sentences;
create policy "Public can read sentences" on sentences for select using (true);

drop policy if exists "Public can read word_sentences" on word_sentences;
create policy "Public can read word_sentences" on word_sentences for select using (true);
