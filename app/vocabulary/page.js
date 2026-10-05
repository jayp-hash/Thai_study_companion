import { supabasePublic } from '../lib/supabase-public';
import Deck from './Deck';

// Re-check the database at most once an hour. So after you re-run the
// import script, the live site picks up the changes within the hour —
// no redeploy needed. (Without this, Next.js would freeze the word list
// at whatever it was on the day the site was built.)
export const revalidate = 3600;

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

async function loadWords() {
  const words = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // "sentences(...)" pulls each word's linked sentences through the
    // word_sentences link table — the same JOIN as the SQL query, done for us.
    const { data, error } = await supabasePublic
      .from('vocabulary')
      .select('id, thai, romanization, english, frequency_rank, sentences(id, thai, romanization, english, review_status)')
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
    // Shortest (simplest) sentences first, max 2 per card, skip rejected ones
    sentences: (w.sentences || [])
      .filter((s) => s.review_status !== 'rejected')
      .sort((a, b) => a.thai.length - b.thai.length)
      .slice(0, 2),
  }));
}

export default async function VocabularyPage() {
  // If the database can't be reached, this throws on purpose: on the live
  // site Next.js then keeps showing the last good version of the page
  // instead of caching an error message for an hour.
  const words = await loadWords();

  return (
    <main className="page">
      <a href="/" className="back-link">&larr; Back home</a>
      <p className="eyebrow">Vocabulary</p>
      <h1 className="page-title">Flashcards</h1>
      <p className="page-subtitle">
        {words.length} course words, most common first, in sets of 20. Tap the card
        to flip it, press the speaker to hear it, and use the arrow keys or buttons to move
        through the set.
      </p>

      <Deck words={words} />
    </main>
  );
}
