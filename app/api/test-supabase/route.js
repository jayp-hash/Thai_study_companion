import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return Response.json({ ok: true, message: `Connected. "profiles" table has ${count} row(s).` });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
