'use client';

// Shown only if the word list can't be loaded at all (e.g. Supabase paused).
export default function VocabularyError({ error, reset }) {
  return (
    <main className="page">
      <a href="/" className="back-link">&larr; Back home</a>
      <p className="deck-error">
        Couldn&rsquo;t load the flashcards right now. If the database was paused, restore it in
        Supabase and try again.
      </p>
      <button type="button" className="deck-btn" onClick={() => reset()}>Try again</button>
    </main>
  );
}
