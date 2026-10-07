import { supabasePublic } from './supabase-public';
import { categoryFor } from './categories';

// Loads every course word with its sample sentence, in course order.
// Used by the full deck (/vocabulary) and the daily session (/today).
const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

export async function loadWords() {
  const words = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // "word_sentences(...)" pulls each word's links from the link table,
    // including the is_sample flag, and "sentences(...)" inside it follows
    // each link to the sentence itself — a JOIN across both tables.
    const { data, error } = await supabasePublic
      .from('vocabulary')
      .select('id, thai, romanization, english, frequency_rank, category, word_sentences(is_sample, sentences(id, thai, romanization, english, review_status, words))')
      // Learner order (survival → everyday → formal), set in the workbook
      .order('course_order', { ascending: true, nullsFirst: false })
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    words.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  // Turn the averaged source ranks (several words can share ~the same
  // average) into a strict order 1, 2, 3… for the everyday-Thai estimate.
  const ordinal = new Map(
    words.filter((w) => w.frequency_rank > 0)
      .sort((a, b) => a.frequency_rank - b.frequency_rank)
      .map((w, i) => [w.thai, i + 1])
  );

  return words.map((w, i) => ({
    position: i + 1, // 1 = most common word in the course
    thai: w.thai,
    romanization: w.romanization,
    english: w.english,
    frequencyRank: ordinal.get(w.thai) || null, // for the everyday-Thai estimate
    category: categoryFor(w.category), // { name, color, edge } for the card's band
    // One sample sentence per card: the one chosen in the Sentence Worksheet.
    // Words without a chosen sentence show "coming soon" for now.
    sentences: (w.word_sentences || [])
      .filter((l) => l.is_sample && l.sentences && l.sentences.review_status !== 'rejected')
      .map((l) => l.sentences)
      .slice(0, 1),
  }));
}

