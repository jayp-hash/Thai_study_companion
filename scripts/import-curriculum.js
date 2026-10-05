#!/usr/bin/env node
// Loads the curriculum workbook into Supabase.
//
//   Workbook tabs used:  Vocabulary, Sentence Patterns, Sentence Structures,
//                        "Sentence Drafts" if it exists, and "Sentence Worksheet"
//                        (one chosen sample sentence per word, for the flashcards).
//   Supabase tables:     vocabulary, sentences, word_sentences
//                        (create them first with supabase/001_vocabulary_and_sentences.sql)
//
// Usage (from the project folder):
//   node scripts/import-curriculum.js
//   node scripts/import-curriculum.js "/path/to/other/workbook.xlsx"
//
// The spreadsheet is the source of truth: edit it, then re-run this script.
// Rows are matched by their Thai text, so re-running updates existing rows
// instead of duplicating them. Rows you delete from the spreadsheet are NOT
// deleted from the database automatically — the script lists them so you can
// decide.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

// ---------- settings ----------
function loadEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const WORKBOOK = process.argv[2] ||
  path.join(__dirname, '..', '..', 'thai-study-companion-content', 'thai_curriculum_source_data.xlsx');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // secret key: allowed to write, never used in the website
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

// ---------- reading the workbook ----------
function text(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('').trim();
    if ('result' in v) return text(v.result);      // formula cell
    if (v.text) return String(v.text).trim();      // hyperlink cell
  }
  return String(v).trim();
}

// Returns rows as objects keyed by the header text in row 1
function sheetRows(ws) {
  const headers = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (headers[i] = text(c.value)));
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = text(row.getCell(i).value); });
    rows.push(o);
  });
  return rows;
}

const col = (row, startsWith) => {
  const key = Object.keys(row).find((k) => k.toLowerCase().startsWith(startsWith.toLowerCase()));
  return key ? row[key] : '';
};

function guessType(thai) {
  return /(ไหม|มั้ย|หรือ(เปล่า)?|ใคร|อะไร|ที่ไหน|เมื่อไหร่|เท่าไหร่|ยังไง|อย่างไร|กี่)\s*(ครับ|คะ|ค่ะ)?\s*[?？]?$/.test(thai) || /[?？]\s*$/.test(thai)
    ? 'Question' : 'Statement';
}

// ---------- main ----------
async function upsertInBatches(table, rows, select) {
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'thai' }).select(select);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
  }
  return out;
}

async function main() {
  console.log(`Reading ${WORKBOOK}\n`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK);
  const now = new Date().toISOString();

  // --- vocabulary ---
  const vocab = sheetRows(wb.getWorksheet('Vocabulary'))
    .filter((r) => r['Thai'] && col(r, 'Include').toUpperCase() === 'Y')
    .map((r) => ({
      thai: r['Thai'],
      romanization: col(r, 'FINAL Romanization'),
      english: col(r, 'FINAL English'),
      frequency_rank: col(r, 'Avg Rank') ? Number(col(r, 'Avg Rank')) : null,
      sources_count: Number(col(r, 'Sources Count')) || 0,
      notes: col(r, 'Notes') || null,
      updated_at: now,
    }));

  // --- sentences ---
  const sentences = new Map(); // keyed by Thai text, so duplicates collapse to one row
  const dupes = [];
  const add = (s) => {
    if (!s.thai) return;
    if (sentences.has(s.thai)) { dupes.push(s.thai); return; }
    sentences.set(s.thai, { ...s, updated_at: now });
  };

  let category = '';
  for (const r of sheetRows(wb.getWorksheet('Sentence Patterns'))) {
    if (r['Category']) category = r['Category'];       // category is only written on the first row of each group
    add({
      thai: r['Thai'], romanization: r['Romanized'] || null, english: r['English'] || null,
      category, sentence_type: col(r, 'Sentence Type') || guessType(r['Thai'] || ''),
      source: 'Sentence Patterns tab', review_status: 'unreviewed',
    });
  }
  for (const r of sheetRows(wb.getWorksheet('Sentence Structures'))) {
    const thai = col(r, 'Example Sentence (Thai)');
    if (!thai) continue;                                // skips the footnote row
    add({
      thai, romanization: col(r, 'Example (Romanization)') || null, english: col(r, 'Example (English)') || null,
      category: `Grammar: ${col(r, 'Pattern (English')}`, sentence_type: guessType(thai),
      source: 'Sentence Structures tab', review_status: 'unreviewed',
    });
  }
  const drafts = wb.getWorksheet('Sentence Drafts');
  if (drafts) {
    for (const r of sheetRows(drafts)) {
      add({
        thai: r['Thai'], romanization: col(r, 'Romaniz') || null, english: r['English'] || null,
        category: r['Category'] || 'Draft', sentence_type: col(r, 'Sentence Type') || guessType(r['Thai'] || ''),
        source: 'Claude draft', review_status: col(r, 'Review Status') || 'needs_native_review',
      });
    }
  }

  // --- flashcard sample sentences (Sentence Worksheet tab) ---
  // One row per word. Where the Thai column is filled in, that sentence
  // becomes the word's sample sentence on its flashcard.
  const samples = []; // { word, thai }
  const worksheet = wb.getWorksheet('Sentence Worksheet');
  if (worksheet) {
    for (const r of sheetRows(worksheet)) {
      const word = r['Word'];
      const thai = r['Thai (Claude fills in)'];
      if (!word || !thai) continue;
      samples.push({ word, thai });
      if (!sentences.has(thai)) {
        add({
          thai, romanization: r['Romanization (Claude fills in)'] || null, english: r['Your English sentence'] || null,
          category: 'Flashcard sample', sentence_type: guessType(thai),
          source: 'Sentence Worksheet', review_status: 'needs_native_review',
        });
      }
    }
  }

  // --- write words + sentences ---
  process.stdout.write(`Uploading ${vocab.length} words... `);
  const savedWords = await upsertInBatches('vocabulary', vocab, 'id, thai');
  console.log('done');
  process.stdout.write(`Uploading ${sentences.size} sentences... `);
  const savedSentences = await upsertInBatches('sentences', [...sentences.values()], 'id, thai');
  console.log('done');

  // --- link words to sentences ---
  // Thai has no spaces, so we split each sentence into words with the
  // built-in Thai word splitter, then also check runs of 2-5 neighbouring
  // pieces so compound words (e.g. บัตรเครดิต = บัตร + เครดิต) still match.
  // This avoids false matches like มา (come) inside หมา (dog).
  const wordId = new Map(savedWords.map((w) => [w.thai, w.id]));
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const links = new Map(); // "wordId-sentenceId" -> link, so no link is stored twice
  const link = (word_id, sentence_id, is_sample = false) => {
    const key = `${word_id}-${sentence_id}`;
    links.set(key, { word_id, sentence_id, is_sample: is_sample || links.get(key)?.is_sample || false });
  };
  for (const s of savedSentences) {
    const parts = [...segmenter.segment(s.thai)].map((x) => x.segment);
    const found = new Set();
    for (let i = 0; i < parts.length; i++) {
      let joined = '';
      for (let j = i; j < Math.min(parts.length, i + 5); j++) {
        joined += parts[j];
        if (wordId.has(joined)) found.add(wordId.get(joined));
      }
    }
    for (const id of found) link(id, s.id);
  }

  // The chosen sample sentences are linked directly from the worksheet row,
  // not by guessing — so they always reach the right card.
  const sentenceId = new Map(savedSentences.map((s) => [s.thai, s.id]));
  let sampleCount = 0;
  for (const { word, thai } of samples) {
    if (!wordId.has(word)) { console.log(`  Sample skipped: "${word}" is not in the Vocabulary tab`); continue; }
    link(wordId.get(word), sentenceId.get(thai), true);
    sampleCount++;
  }
  const linkRows = [...links.values()];

  process.stdout.write(`Linking words to sentences (${linkRows.length} links)... `);
  const ids = savedSentences.map((s) => s.id);
  const { error: delErr } = await db.from('word_sentences').delete().in('sentence_id', ids);
  if (delErr) throw new Error(`word_sentences delete: ${delErr.message}`);
  for (let i = 0; i < linkRows.length; i += 1000) {
    const { error } = await db.from('word_sentences').insert(linkRows.slice(i, i + 1000));
    if (error) throw new Error(`word_sentences: ${error.message}`);
  }
  console.log('done');

  // --- report ---
  const covered = new Set(linkRows.map((l) => l.word_id));
  console.log(`\nSummary`);
  console.log(`  Words:      ${savedWords.length}`);
  console.log(`  Sentences:  ${savedSentences.length}`);
  console.log(`  Words with at least one sample sentence: ${covered.size} of ${savedWords.length}`);
  console.log(`  Flashcard sample sentences (from Sentence Worksheet): ${sampleCount}`);
  if (dupes.length) console.log(`  Skipped duplicate sentences: ${dupes.join(', ')}`);

  const missingTop = vocab
    .filter((w) => !covered.has(wordId.get(w.thai)) && w.frequency_rank !== null)
    .sort((a, b) => a.frequency_rank - b.frequency_rank)
    .slice(0, 15)
    .map((w) => `${w.thai} (${w.english})`);
  console.log(`  Most common words still without a sentence: ${missingTop.join(', ')}`);

  // Rows in the database that are no longer in the spreadsheet (listed, not deleted)
  const { data: dbWords } = await db.from('vocabulary').select('thai');
  const extra = (dbWords || []).filter((w) => !wordId.has(w.thai)).map((w) => w.thai);
  if (extra.length) console.log(`  In database but not in spreadsheet (not deleted): ${extra.join(', ')}`);

  console.log('\nDone. Open Supabase → Table Editor to see the tables.');
}

main().catch((err) => { console.error('\nImport failed:', err.message); process.exit(1); });
