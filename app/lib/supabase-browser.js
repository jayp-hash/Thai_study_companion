'use client';
import { createClient } from '@supabase/supabase-js';

// Supabase client for the browser, used for signing in and saving progress.
// Uses the PUBLIC key; Row Level Security in the database makes sure each
// person can only read and change their own rows.
//
// flowType 'pkce': the sign-in link carries a one-time code that only works
// in the browser that asked for it, which is safer than putting the login
// token itself in the address bar.
let client;
export function supabaseBrowser() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return client;
}
