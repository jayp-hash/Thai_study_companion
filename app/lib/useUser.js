'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase-browser';

// The signed-in person, or null. `ready` is false until we've checked.
export function useUser() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const db = supabaseBrowser();
    db.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setReady(true); });
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, ready };
}
