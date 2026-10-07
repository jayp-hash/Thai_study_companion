// Privacy policy. Google requires this page before the
// "Continue with Google" sign-in can be opened to everyone.
// To show a contact email, fill in CONTACT_EMAIL.
const CONTACT_EMAIL = '';
const UPDATED = '7 October 2026';

export const metadata = { title: 'Privacy policy · Thai Study Companion' };

export default function Privacy() {
  const contact = CONTACT_EMAIL
    ? <>email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>
    : <>open an issue on the <a href="https://github.com/jayp-hash/Thai_study_companion">project page</a></>;
  return (
    <main className="page prose">
      <p className="eyebrow">Last updated {UPDATED}</p>
      <h1 className="page-title">Privacy policy</h1>
      <p>Thai Study Companion is a small, independent app for learning Thai. This page explains what we store about you and why.</p>

      <h2>Using the app without an account</h2>
      <p>You can study without signing in. Your progress and settings are then kept only in your own browser (local storage) and are not sent to us.</p>

      <h2>What we store when you sign in</h2>
      <ul>
        <li><b>Your email address</b>, and your name if you sign in with Google. We use these to sign you in and to show you who you're signed in as.</li>
        <li><b>Your learning progress</b>: which words you've studied, how well you knew them and when you last saw them. We use this to show you the right cards and to follow your progress across devices.</li>
      </ul>
      <p>We don't sell your data, show ads or share your information with advertisers.</p>

      <h2>Services we use</h2>
      <ul>
        <li><b>Supabase</b> stores accounts and progress.</li>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Google</b> handles sign-in if you choose "Continue with Google".</li>
        <li><b>ElevenLabs</b> generates the Thai audio. Only course text (Thai words and sentences) is sent, never anything about you.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>You can reset your progress at any time from the Aa menu on the flashcards. To delete your account and everything stored with it, {contact} and we'll remove it.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we'll update the date at the top of this page.</p>
    </main>
  );
}
