import { supabasePublic } from '../lib/supabase-public';
import Deck from './Deck';
import { categoryFor } from '../lib/categories';

// Re-check the database at most once an hour. So after you re-run the
// import script, the live site picks up the changes within the hour —
// no redeploy needed. (Without this, Next.js would freeze the word list
// at whatever it was on the day the site was built.)
export const revalidate = 3600;

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

async function loadWords() {
  const words = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // "word_sentences(...)" pulls each word's links from the link table,
    // including the is_sample flag, and "sentences(...)" inside it follows
    // each link to the sentence itself — a JOIN across both tables.
    const { data, error } = await supabasePublic
      .from('vocabulary')
      .select('id, thai, romanization, english, frequency_rank, category, word_sentences(is_sample, sentences(id, thai, romanization, english, review_status, words))')
      .order('frequency_rank', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    words.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return words.map((w, i) => ({
    position: i + 1, // 1 = most common word in the course
    thai: w.thai,
    romanization: w.romanization,
    english: w.english,
    category: categoryFor(w.category), // { name, color, edge } for the card's band
    // One sample sentence per card: the one chosen in the Sentence Worksheet.
    // Words without a chosen sentence show "coming soon" for now.
    sentences: (w.word_sentences || [])
      .filter((l) => l.is_sample && l.sentences && l.sentences.review_status !== 'rejected')
      .map((l) => l.sentences)
      .slice(0, 1),
  }));
}

export default async function VocabularyPage() {
  // If the database can't be reached, this throws on purpose: on the live
  // site Next.js then keeps showing the last good version of the page
  // instead of caching an error message for an hour.
  const words = await loadWords();

  return (
    <main className="page">
      {/* Compact title, so the whole card fits on screen without scrolling */}
      <div className="fc-page-title">
        <h1>Flashcards</h1>
        <span>{words.length} words, most common first</span>
      </div>

      <Deck words={words} />
    </main>
  );
}
