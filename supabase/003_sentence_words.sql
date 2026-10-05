-- =====================================================================
-- 003: Word boxes for sample sentences
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- Thai is written without spaces, so the app can't reliably tell where
-- one word ends and the next begins. This column stores the split made
-- in the Sentence Worksheet, word by word, with each word's romanization:
--   [{"th": "ฉัน", "rom": "chǎn"}, {"th": "อยู่", "rom": "yùu"}, ...]
-- The flashcard shows one box per word, and each box can be tapped to
-- hear that word on its own.
alter table sentences
  add column if not exists words jsonb;
