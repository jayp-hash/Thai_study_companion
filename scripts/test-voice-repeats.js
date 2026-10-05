#!/usr/bin/env node
// Consistency test for the audio pillar issue: does the SAME word come out the
// same way every time? Generates several takes of one word for each chosen
// voice + stability pick, using the same model/settings as app/api/speak.
//
// Usage:
//   node scripts/test-voice-repeats.js                     (defaults to สวัสดี)
//   node scripts/test-voice-repeats.js ขอบคุณ ไม่ หมา ม้า    (several words, one folder each)
//
// Output: voice-tests/repeats/<word>/Amy_0.3_take-1.mp3 ... (gitignored)
// Needs ELEVENLABS_API_KEY in .env.local, with Voices: Read permission.

const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY not found in .env.local');
  process.exit(1);
}

const WORDS = process.argv.slice(2).length ? process.argv.slice(2) : ['สวัสดี'];
const TAKES = 5;
// Round 2 (2026-10-02): Amy 0.3 was mostly consistent; Chris 0.5 drifted between
// rising/falling tones, so Chris is retested at the higher-stability end.
const PICKS = [
  { name: 'Amy', stability: 0.3 },
  { name: 'Chris', stability: 0.85 },
  { name: 'Chris', stability: 1.0 },
];

async function getVoices() {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': API_KEY } });
  if (!res.ok) throw new Error(`Failed to list voices: ${res.status} ${await res.text()}`);
  return (await res.json()).voices || [];
}

async function generate(voiceId, text, stability) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: /[.!?ๆฯ]\s*$/.test(text) ? text : `${text}.`,
      model_id: 'eleven_v3', // same model as app/api/speak
      voice_settings: { stability, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log(`Consistency test: ${WORDS.join(', ')} — ${TAKES} takes per pick\n`);
  const voices = await getVoices();

  for (const word of WORDS) {
    console.log(`--- ${word} ---`);
    const outDir = path.join(__dirname, '..', 'voice-tests', 'repeats', word);
    fs.mkdirSync(outDir, { recursive: true });

    for (const pick of PICKS) {
      const voice = voices.find((v) => v.name.toLowerCase().includes(pick.name.toLowerCase()));
      if (!voice) {
        console.error(`No saved voice matching "${pick.name}" — skipping.`);
        continue;
      }
      for (let i = 1; i <= TAKES; i++) {
        const label = `${pick.name}_${pick.stability}_take-${i}`;
        process.stdout.write(`Generating ${label}... `);
        try {
          fs.writeFileSync(path.join(outDir, `${label}.mp3`), await generate(voice.voice_id, word, pick.stability));
          console.log('done');
        } catch (err) {
          console.log('FAILED');
          console.error(`  ${err.message}`);
        }
      }
    }
  }
  console.log('\nDone. Each word has its own folder in voice-tests/repeats/');
  console.log("Play each voice's takes back to back: do they sound like the same recording?");
}

main().catch((err) => { console.error(err); process.exit(1); });
