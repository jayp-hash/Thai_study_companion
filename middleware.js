// Hides the diagnostic pages (/test and /api/test-*) on the live site.
//
// They were useful for checking that Supabase, Stripe and ElevenLabs were
// connected, but in public they leak which services we use, and
// /api/test-elevenlabs spends audio credit every time anyone opens it.
//
// They still work on your own computer (npm run dev). To turn them on in
// production for a quick check, set DIAGNOSTICS_ENABLED=true in Vercel's
// environment variables, then remove it again afterwards.

import { NextResponse } from 'next/server';

export function middleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.DIAGNOSTICS_ENABLED !== 'true') {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/test', '/api/test-:path*'],
};
