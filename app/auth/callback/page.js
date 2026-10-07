'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase-browser';

// Google and the email link both send people back here. The Supabase
// client reads the one-time code from the address bar and turns it into
// a signed-in session, then we move on to the cards.
export default function AuthCallback() {
  const [problem, setProblem] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errText = params.get('error_description') || params.get('error');
    if (errText) { setProblem(errText); return; }

    const db = supabaseBrowser();
    let done = false;
    const go = () => { if (!done) { done = true; window.location.replace('/vocabulary'); } };
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    db.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // If nothing happens, the link was probably opened in a different
    // browser from the one that asked for it.
    const t = setTimeout(() => {
      if (!done) setProblem('This sign-in link has expired or was opened in a different browser from the one you used to ask for it.');
    }, 8000);
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  return (
    <main className="page auth">
      <div className="auth-card">
        {problem ? (
          <>
            <h1 className="auth-title">That didn't work</h1>
            <p className="auth-sub">{problem}</p>
            <a className="auth-btn primary" href="/signin">Try again</a>
          </>
        ) : (
          <>
            <h1 className="auth-title">Signing you in…</h1>
            <p className="auth-sub">One moment.</p>
          </>
        )}
      </div>
    </main>
  );
}
