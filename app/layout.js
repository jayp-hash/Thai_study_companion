import './globals.css';
import Header from './components/Header';

export const metadata = {
  title: 'Thai Study Companion',
  description: 'Vocabulary, sentence patterns, and listening practice for learning Thai.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
