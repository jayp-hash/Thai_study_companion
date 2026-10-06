// Thai text-to-speech endpoint: GET /api/speak?text=สวัสดี
//
// Three protections, because this endpoint spends ElevenLabs credit:
//   1. Length limit: nothing longer than MAX_CHARS is ever sent.
//   2. Course content only: the text must be a course word, a sentence,
//      or one of the word boxes inside a sentence (e.g. ผัดไทย).
//      Random text from strangers gets a 403.
//   3. Caching: a successful clip is cached for a year by the browser and
//      by Vercel's CDN. So each word is generated once, not on every
//      click, and everyone hears the same take (which also fixes the
//      "same word sounds different each time" problem for cached words).
//
// Why GET instead of POST: CDNs only cache GET requests.
//
// Model is eleven_v4 (supports Thai). Chosen by ear in the 2026-10-06 audio
// lab (scripts/audio-lab.js): v4 was clearer, less rushed and more consistent
// than eleven_v3 at stability 0.3, which sometimes clipped or sped up words.
//
// Voice is Amy for now. Once the ครับ/ค่ะ speech-style switch exists,
// a `voice` param here will pick between Amy and Chris.

import { supabasePublic } from '../../lib/supabase-public';

const AMY_VOICE_ID = 'OZxMHsGaBmV5pjMIDIn0'; // female voice

// Male voice: ElevenLabs' "Chris". Its ID is looked up by name once and
// remembered (or set ELEVENLABS_MALE_VOICE_ID in Vercel to skip the lookup).
let maleVoiceId = process.env.ELEVENLABS_MALE_VOICE_ID || null;
async function getMaleVoiceId() {
  if (maleVoiceId) return maleVoiceId;
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  if (!res.ok) throw new Error(`voice lookup failed: ${res.status}`);
  const chris = ((await res.json()).voices || []).find((v) => v.name.startsWith('Chris'));
  if (!chris) throw new Error('male voice "Chris" not found');
  maleVoiceId = chris.voice_id;
  return maleVoiceId;
}
const MAX_CHARS = 200;
const ONE_YEAR = 60 * 60 * 24 * 365;

async function isCourseText(text) {
  const [word, sentence, box] = await Promise.all([
    supabasePublic.from('vocabulary').select('id').eq('thai', text).limit(1),
    supabasePublic.from('sentences').select('id').eq('thai', text).neq('review_status', 'rejected').limit(1),
    // "contains": any sentence whose word boxes include {"th": text}
    supabasePublic.from('sentences').select('id').contains('words', JSON.stringify([{ th: text }])).neq('review_status', 'rejected').limit(1),
  ]);
  const err = word.error || sentence.error || box.error;
  if (err) throw new Error(err.message);
  return word.data.length > 0 || sentence.data.length > 0 || box.data.length > 0;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const text = (params.get('text') || '').trim();
  const voice = params.get('voice') === 'male' ? 'male' : 'female';

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

    const voiceId = voice === 'male' ? await getMaleVoiceId() : AMY_VOICE_ID;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: speechText,
        model_id: 'eleven_v4',
        // Stability trades expressiveness for consistency. For learners,
        // consistency wins: the same word should sound the same every time.
        // Speed 0.85 = a little slower than normal conversation.
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
          speed: 0.85,
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
