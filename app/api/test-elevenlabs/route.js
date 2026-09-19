const AMY_VOICE_ID = 'OZxMHsGaBmV5pjMIDIn0';

export async function GET() {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${AMY_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'สวัสดีค่ะ ระบบเชื่อมต่อเรียบร้อยแล้วค่ะ',
        model_id: 'eleven_multilingual_v2',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ ok: false, error: errText }, { status: 500 });
    }
    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, { headers: { 'Content-Type': 'audio/mpeg' } });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
