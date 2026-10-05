import './globals.css';
import { Sarabun, Baloo_2, Nunito } from 'next/font/google';
import Header from './components/Header';

// Fonts are downloaded at build time and served from our own site
// (faster, and no request to Google from the visitor's browser).
// Sarabun: the classic Thai textbook typeface, with the small loops on
// letters (ม ห ด) that help learners tell similar letters apart.
const sarabun = Sarabun({ subsets: ['thai', 'latin'], weight: ['400', '600', '700'], variable: '--font-thai', display: 'swap' });
const baloo = Baloo_2({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], weight: ['500', '700', '800'], style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'Thai Study Companion',
  description: 'Vocabulary, sentence patterns, and listening practice for learning Thai.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sarabun.variable} ${baloo.variable} ${nunito.variable}`}>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
