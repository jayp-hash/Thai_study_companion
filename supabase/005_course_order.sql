-- =====================================================================
-- 005: Course order (the order a learner meets the words)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- frequency_rank = how common a word is in Thai text (from the source lists).
-- course_order  = when a LEARNER should meet it: survival words first,
--                 everyday words next, formal/news words last.
-- The flashcards follow course_order. Set in the workbook's
-- Vocabulary → Course Order column.
alter table vocabulary
  add column if not exists course_order integer,
  add column if not exists stage text;
