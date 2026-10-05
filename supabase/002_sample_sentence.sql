-- =====================================================================
-- 002: One chosen sample sentence per word
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- Each link between a word and a sentence gets a yes/no flag:
-- "is this THE sample sentence shown on this word's flashcard?"
-- Default is no, so all existing links stay exactly as they are.
alter table word_sentences
  add column if not exists is_sample boolean not null default false;

-- Rule enforced by the database: a word can have at most ONE sample sentence.
-- (A "partial unique index" only counts the rows where is_sample is true.)
create unique index if not exists word_sentences_one_sample_per_word
  on word_sentences (word_id) where is_sample;
