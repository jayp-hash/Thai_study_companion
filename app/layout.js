export const metadata = {
  title: "Thai Study Companion",
  description: "Vocabulary, sentence patterns, and listening practice built from Can You Speak Thai.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
