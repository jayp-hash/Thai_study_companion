import { createClient } from '@supabase/supabase-js';

// Read-only Supabase client for pages. Uses the PUBLIC (anon/publishable)
// key, which is safe to use in a website: the database's Row Level Security
// rules only allow it to READ the vocabulary/sentences tables, never change
// them. (The secret service-role key is only used by scripts on Jay's Mac.)
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
