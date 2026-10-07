'use client';
import { useState } from 'react';
import { supabaseBrowser } from '../lib/supabase-browser';
import { useUser } from '../lib/useUser';

// Sign in with Google, or get a one-time sign-in link by email.
// Signing in is optional: it saves your progress so it follows you
// between devices.
export default function SignIn() {
  const { user, ready } = useUser();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  const back = () => `${window.location.origin}/auth/callback`;

  const google = async () => {
    setError('');
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: back() },
    });
    if (error) { setStatus('error'); setError(error.message); }
  };

  const sendLink = async (e) => {
    e.preventDefault();
    setStatus('sending'); setError('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: back() },
    });
    if (error) { setStatus('error'); setError(error.message); } else setStatus('sent');
  };

  if (ready && user) {
    return (
      <main className="page auth">
        <div className="auth-card">
          <h1 className="auth-title">You're signed in</h1>
          <p className="auth-sub">Signed in as <b>{user.email}</b>. Your progress is saved to your account.</p>
          <a className="auth-btn primary" href="/vocabulary">Go to my cards</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page auth">
      <div className="auth-card">
        <h1 className="auth-title">Save your progress</h1>
        <p className="auth-sub">Sign in so your cards, streak and progress follow you to any device.</p>

        <button type="button" className="auth-btn google" onClick={google}>
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-or"><span>or</span></div>

        {status === 'sent' ? (
          <div className="auth-sent">
            <b>Check your email.</b> We sent a sign-in link to {email}. Open it on this device, in this browser.
            <button type="button" className="auth-link" onClick={() => setStatus('idle')}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={sendLink} className="auth-form">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" type="email" required autoComplete="email" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className="auth-btn primary" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        {status === 'error' && <p className="auth-error">Couldn't sign you in: {error}. Please try again.</p>}

        <p className="auth-fine">No password needed. By signing in you agree to our <a href="/privacy">privacy policy</a>.</p>
      </div>
    </main>
  );
}
