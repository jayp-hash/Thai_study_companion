import Today from './Today';
import { loadWords } from '../lib/words';
import { ProgressProvider } from '../lib/progress';

export const revalidate = 3600;
export const metadata = { title: 'Today · Thai Study Companion' };

// The daily session: words due for review plus a few new ones.
export default async function TodayPage() {
  const words = await loadWords();
  return (
    <main className="page">
      <ProgressProvider>
        <Today words={words} />
      </ProgressProvider>
    </main>
  );
}
