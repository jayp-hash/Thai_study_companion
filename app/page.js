import Landing from './components/Landing';
import { loadWords, coverageCurve } from './lib/words';

// Re-check the word list at most once an hour.
export const revalidate = 3600;

// One real card per kind of learner, shown in the hero
const DEMO = { live: 'ถุง', partner: 'แม่', visit: 'ห้องน้ำ' };

export default async function Home() {
  const words = await loadWords();
  const demo = Object.fromEntries(
    Object.entries(DEMO).map(([persona, thai]) => {
      const w = words.find((x) => x.thai === thai) || words[0];
      return [persona, { thai: w.thai, romanization: w.romanization, english: w.english, position: w.position, category: w.category, sentence: w.sentences[0] || null }];
    })
  );
  const curve = coverageCurve(words, [50, 120, 300, words.length]);
  return <Landing wordCount={words.length} demo={demo} curve={curve} />;
}
