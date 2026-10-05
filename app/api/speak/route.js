// Thai text-to-speech endpoint: GET /api/speak?text=สวัสดี
//
// Three protections, because this endpoint spends ElevenLabs credit:
//   1. Length limit: nothing longer than MAX_CHARS is ever sent.
//   2. Course content only: the text must exist in the vocabulary or
//      sentences table. Random text from strangers gets a 403.
//   3. Caching: a successful clip is cached for a year by the browser and
//      by Vercel's CDN. So each word is generated once, not on every
//      click, and everyone hears the same take (which also fixes the
//      "same word sounds different each time" problem for cached words).
//
// Why GET instead of POST: CDNs only cache GET requests.
//
// Model is eleven_v3: the only ElevenLabs model that officially supports
// Thai. multilingual_v2 returns audio but guesses at the pronunciation.
//
// Voice is Amy for now. Once the ครับ/ค่ะ speech-style switch exists,
// a `voice` param here will pick between Amy and Chris.

import { supabasePublic } from '../../lib/supabase-public';

const AMY_VOICE_ID = 'OZxMHsGaBmV5pjMIDIn0';
const MAX_CHARS = 200;
const ONE_YEAR = 60 * 60 * 24 * 365;

async function isCourseText(text) {
  const [word, sentence] = await Promise.all([
    supabasePublic.from('vocabulary').select('id').eq('thai', text).limit(1),
    supabasePublic.from('sentences').select('id').eq('thai', text).neq('review_status', 'rejected').limit(1),
  ]);
  if (word.error || sentence.error) throw new Error((word.error || sentence.error).message);
  return word.data.length > 0 || sentence.data.length > 0;
}

export async function GET(request) {
  const text = (new URL(request.url).searchParams.get('text') || '').trim();

  if (!text) {
    return Response.json({ ok: false, error: 'Missing "text".' }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json({ ok: false, error: `Text is longer than ${MAX_CHARS} characters.` }, { status: 400 });
  }

  try {
    if (!(await isCourseText(text))) {
      return Response.json({ ok: false, error: 'Only course words and sentences can be played.' }, { status: 403 });
    }

    // Single words seem to get a small audible cut right after they end.
    // An end-of-sentence period tells the model where to stop cleanly.
    const speechText = /[.!?ๆฯ]\s*$/.test(text) ? text : `${text}.`;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${AMY_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: speechText,
        model_id: 'eleven_v3',
        // Stability trades naturalness for consistency. Amy at 0.3 sounded
        // most natural and was mostly consistent in Jay's 2026-10-02 tests.
        voice_settings: {
          stability: 0.3,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      // Don't cache failures, and don't pass ElevenLabs' raw error to the public.
      console.error('ElevenLabs error', res.status, await res.text());
      return Response.json({ ok: false, error: 'Audio is unavailable right now.' }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`,
      },
    });
  } catch (err) {
    console.error('speak failed', err);
    return Response.json({ ok: false, error: 'Audio is unavailable right now.' }, { status: 500 });
  }
}
