'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '../lib/useUser';
import { supabaseBrowser } from '../lib/supabase-browser';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/vocabulary', label: 'Vocabulary' },
];

// "Sign in" when signed out; a round initial with a small menu when signed in.
function Account() {
  const { user, ready } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  if (!ready) return <span className="acct-slot" aria-hidden="true" />;
  if (!user) return <a href="/signin" className="acct-signin">Sign in</a>;

  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || '?';
  const signOut = async () => { await supabaseBrowser().auth.signOut(); window.location.href = '/'; };
  return (
    <div className="acct" ref={ref}>
      <button type="button" className="acct-btn" aria-label="Your account" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {name.trim().charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="acct-menu">
          <div className="acct-who">{user.email}</div>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <a href="/" className="brand">
        <span className="th">ภ</span>Thai Study Companion
      </a>
      <nav>
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'active' : ''}
          >
            {link.label}
          </a>
        ))}
        <Account />
      </nav>
    </header>
  );
}
