-- =====================================================================
-- 004: A category for each word (People & family, Food & drink, ...)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.
-- =====================================================================

-- Filled by the import from the workbook's Vocabulary → Category column.
-- The flashcard colours its band by this category.
alter table vocabulary
  add column if not exists category text;
