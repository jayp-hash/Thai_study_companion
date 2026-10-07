// Starter vocabulary set for the visual prototype.
//
// Pulled directly from thai_curriculum_source_data.xlsx (Vocabulary tab —
// (older list) 896 words, ranked by average frequency across 3 cross-referenced sources).
// This is a small hand-picked slice of the top ~60 most common words, not
// the whole list — once Supabase's content_items table exists, this file
// goes away and the Vocabulary page queries that table instead. Nothing
// about the UI below should need to change when that happens; only where
// the data comes from.
//
// rank = the word's average-rank position in the full 500-word frequency
// list (lower = more common). Shown on the card as a quick "how common is
// this" signal.

export const VOCABULARY = [
  { thai: 'และ', roman: 'láe', english: 'and', rank: 2 },
  { thai: 'ใน', roman: 'nai', english: 'in; inside', rank: 4 },
  { thai: 'ของ', roman: 'khǎawng', english: 'of; belonging to', rank: 5.5 },
  { thai: 'มี', roman: 'mii', english: 'to have; there is', rank: 6.5 },
  { thai: 'เป็น', roman: 'bpen', english: 'to be (copula); to become', rank: 9 },
  { thai: 'ไม่', roman: 'mâi', english: 'no; not', rank: 23 },
  { thai: 'จะ', roman: 'jà', english: 'will (future marker)', rank: 23 },
  { thai: 'ไป', roman: 'bpai', english: 'to go', rank: 25 },
  { thai: 'คน', roman: 'khon', english: 'person; classifier for people', rank: 26 },
  { thai: 'ผม', roman: 'phǒm', english: 'I / me (male, polite)', rank: 29 },
  { thai: 'ฉัน', roman: 'chǎn', english: 'I / me (female or informal)', rank: 41 },
  { thai: 'มา', roman: 'maa', english: 'to come', rank: 29.7 },
  // พวกเรา, not bare เรา — เรา alone is a casual/intimate "I", not "we".
  // Not an independently-ranked word in the frequency list (it's พวก + เรา,
  // both already-known words), so the rank below is approximate, matching
  // where เรา sat rather than a real frequency measurement.
  { thai: 'พวกเรา', roman: 'phûak rao', english: 'we; us', rank: 31 },
  { thai: 'นี้', roman: 'níi', english: 'this', rank: 32.5 },
  { thai: 'ปี', roman: 'bpii', english: 'year', rank: 34.3 },
  { thai: 'ทำ', roman: 'tham', english: 'to do; to make', rank: 35.3 },
  { thai: 'วัน', roman: 'wan', english: 'day', rank: 54 },
  { thai: 'สอง', roman: 'sǎawng', english: 'two', rank: 52 },
];
