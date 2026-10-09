import './globals.css';
import { Sarabun, Baloo_2, Nunito, Kanit } from 'next/font/google';
import Header from './components/Header';

// Fonts are downloaded at build time and served from our own site
// (faster, and no request to Google from the visitor's browser).
// Sarabun: the classic Thai textbook typeface, with the small loops on
// letters (ม ห ด) that help learners tell similar letters apart.
const sarabun = Sarabun({ subsets: ['thai', 'latin'], weight: ['400', '600', '700'], variable: '--font-thai', display: 'swap' });
const baloo = Baloo_2({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display', display: 'swap' });
// Kanit: the heavy Thai face on Bangkok shop and street signs (Soi Talk logo and headings)
const kanit = Kanit({ subsets: ['thai', 'latin'], weight: ['500', '700', '800'], variable: '--font-sign', display: 'swap' });
const nunito = Nunito({ subsets: ['latin'], weight: ['500', '700', '800'], style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });

export const metadata = {
  title: 'Soi Talk · Thai for your street',
  description: 'Learn the Thai your street actually speaks: the most useful words first, real audio, and one sentence to say out loud every day.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sarabun.variable} ${baloo.variable} ${nunito.variable} ${kanit.variable}`}>
      <body>
        {/* Thailand's colour of the day (Sun red, Mon yellow, Tue pink, Wed green, Thu orange, Fri blue, Sat purple) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.style.setProperty('--day',['#E5383B','#F2C200','#EC6AA8','#2BA84A','#F28C28','#3A8DDE','#8E5CC9'][new Date().getDay()])" }} />
        <Header />
        {children}
      </body>
    </html>
  );
}
