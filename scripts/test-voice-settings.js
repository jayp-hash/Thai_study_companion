#!/usr/bin/env node
// Diagnostic script for the audio-consistency problem (pacing/pitch varying
// between generations of the same word). Generates the same text at several
// ElevenLabs `stability` values, across every saved voice whose name matches
// Amy/Chris, so you can listen back-to-back in one sitting instead of
// testing one setting at a time through the browser.
//
// Usage:
//   node scripts/test-voice-settings.js
//   node scripts/test-voice-settings.js "สวัสดี"
//
// Output goes to voice-tests/ (gitignored), one mp3 per voice+stability
// combination, named so they sort predictably, e.g.:
//   voice-tests/Amy - Natural and Sweet_stability-0.85.mp3
//
// Needs ELEVENLABS_API_KEY in .env.local (same file the app already uses).

const fs = require('fs');
const path = require('path');

// --- tiny .env.local reader, no dotenv dependency needed ---
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY not found in .env.local — nothing to test with.');
  process.exit(1);
}

const TEXT = process.argv[2] || 'เรา';
const STABILITY_VALUES = [0.3, 0.5, 0.7, 0.85, 1.0];
const VOICE_NAMES_TO_TEST = ['Amy', 'Chris']; // matched against your saved ElevenLabs voice names

async function getVoices() {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': API_KEY },
  });
  if (!res.ok) {
    throw new Error(`Failed to list voices: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.voices || [];
}

async function generate(voiceId, text, stability) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: /[.!?ๆฯ]\s*$/.test(text) ? text : `${text}.`,
      model_id: 'eleven_v3',
      voice_settings: {
        stability,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Generation failed (voice ${voiceId}, stability ${stability}): ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '-');
}

async function main() {
  console.log(`Testing text: "${TEXT}"\n`);

  const allVoices = await getVoices();
  const matched = allVoices.filter((v) =>
    VOICE_NAMES_TO_TEST.some((name) => v.name.toLowerCase().includes(name.toLowerCase()))
  );

  if (matched.length === 0) {
    console.error(
      `No voices found matching ${VOICE_NAMES_TO_TEST.join('/')}. Your account has: ` +
        allVoices.map((v) => v.name).join(', ')
    );
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'voice-tests');
  fs.mkdirSync(outDir, { recursive: true });

  for (const voice of matched) {
    for (const stability of STABILITY_VALUES) {
      const label = `${safeFileName(voice.name)}_stability-${stability}`;
      process.stdout.write(`Generating ${label}... `);
      try {
        const audio = await generate(voice.voice_id, TEXT, stability);
        fs.writeFileSync(path.join(outDir, `${label}.mp3`), audio);
        console.log('done');
      } catch (err) {
        console.log('FAILED');
        console.error(`  ${err.message}`);
      }
    }
  }

  console.log(`\nAll done — open the voice-tests/ folder and listen through them in order.`);
  console.log(`Whichever stability value first sounds "boring but reliable" rather than`);
  console.log(`"expressive but different every time" is probably the one to lock in.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
