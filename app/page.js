import { supabasePublic } from './lib/supabase-public';

// Re-check the word count at most once an hour.
export const revalidate = 3600;

const sectionsFor = (wordCount) => [
  {
    href: '/today',
    title: 'Today',
    desc: 'Your daily review: the words due today plus a few new ones. Keep your streak going and watch your everyday Thai grow.',
    live: true,
  },
  {
    href: '/vocabulary',
    title: 'Vocabulary',
    desc: `All ${wordCount} course words as flashcards, most useful first, with example sentences on the back. Tap to flip, press play to hear it.`,
    live: true,
  },
  {
    href: '#',
    title: 'Sentence Patterns',
    desc: 'The core grammar patterns of the course, with example sentences and common-mistake call-outs.',
    live: false,
  },
  {
    href: '#',
    title: 'Sentence Structures',
    desc: 'How Thai sentences are actually built: word order, classifiers and particles, one structure at a time.',
    live: false,
  },
  {
    href: '#',
    title: 'Activities',
    desc: 'Picture match, listening practice, and other drills that mix vocabulary and patterns together.',
    live: false,
  },
];

export default async function Home() {
  const { count } = await supabasePublic.from('vocabulary').select('id', { count: 'exact', head: true });
  const SECTIONS = sectionsFor(count ? count.toLocaleString('en') : 'the');
  return (
    <main className="page">
      <p className="eyebrow">Learn Thai</p>
      <h1 className="page-title">Where do you want to start?</h1>
      <p className="page-subtitle">
        This is an early, in-progress look at the course. Vocabulary is live with real
        words and audio. Everything else here is coming soon.
      </p>

      <div className="section-grid">
        {SECTIONS.map((section) =>
          section.live ? (
            <a key={section.title} href={section.href} className="section-card is-live">
              <div className="section-card-top">
                <span className="section-card-title">{section.title}</span>
                <span className="badge badge-live">Live</span>
              </div>
              <p className="section-card-desc">{section.desc}</p>
            </a>
          ) : (
            <div key={section.title} className="section-card is-soon">
              <div className="section-card-top">
                <span className="section-card-title">{section.title}</span>
                <span className="badge badge-soon">Coming soon</span>
              </div>
              <p className="section-card-desc">{section.desc}</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
