#!/usr/bin/env node
// Audio lab: generate the same Thai words and sentences with several
// ElevenLabs model/setting combinations, then compare them side by side.
//
// Why: the app's audio sometimes cuts words off, often sounds too fast,
// and varies between takes. This tests:
//   A  what the app uses now   (eleven_v3, stability 0.3 "creative")
//   B  v3, stability 1.0 "robust" + speed 0.85
//   C  v3, stability 0.5 "natural" + speed 0.85
//   D  eleven_v4 (newer model), stability 0.5 + speed 0.85
//   E  eleven_v4, stability 0.8 + speed 0.85
// Each one makes 2 takes, so you can also hear whether it's consistent.
//
// Usage (from the project folder):   node scripts/audio-lab.js
// Then open voice-tests/lab/index.html in your browser (double-click it).
// Output is in voice-tests/ (not uploaded to GitHub).

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
if (!API_KEY) { console.error('ELEVENLABS_API_KEY not found in .env.local'); process.exit(1); }

const AMY = 'OZxMHsGaBmV5pjMIDIn0'; // same voice as app/api/speak
const OUT = path.join(__dirname, '..', 'voice-tests', 'lab');
const TAKES = 2;

const VARIANTS = [
  { id: 'A', label: 'Now: v3, stability 0.3', model: 'eleven_v3', stability: 0.3 },
  { id: 'B', label: 'v3, stability 1.0, speed 0.85', model: 'eleven_v3', stability: 1.0, speed: 0.85 },
  { id: 'C', label: 'v3, stability 0.5, speed 0.85', model: 'eleven_v3', stability: 0.5, speed: 0.85 },
  { id: 'D', label: 'v4, stability 0.5, speed 0.85', model: 'eleven_v4', stability: 0.5, speed: 0.85 },
  { id: 'E', label: 'v4, stability 0.8, speed 0.85', model: 'eleven_v4', stability: 0.8, speed: 0.85 },
];

// Words that have sounded cut off or rushed, a tone pair, and 3 sentences
const ITEMS = [
  'ไม่เป็นไร', 'เหนื่อย', 'ที่', 'กุมภาพันธ์', 'ผม', 'หมา', 'ม้า',
  'ฉันอยู่ที่บ้าน', 'ฉันอยากได้น้ำและกาแฟ', 'ห้องน้ำอยู่ที่ไหน',
];

async function generate(v, text) {
  const voice_settings = { stability: v.stability, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
  if (v.speed) voice_settings.speed = v.speed;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${AMY}`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // same end-of-sentence full stop as the app, so words end cleanly
      text: /[.!?ๆฯ]\s*$/.test(text) ? text : `${text}.`,
      model_id: v.model,
      voice_settings,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];
  ITEMS.forEach((text, i) => VARIANTS.forEach((v) => {
    for (let t = 1; t <= TAKES; t++) jobs.push({ text, i, v, t, file: `${String(i + 1).padStart(2, '0')}_${v.id}_take${t}.mp3` });
  }));
  const errors = {};
  let done = 0;
  // 4 at a time, so it's quicker without hitting rate limits
  async function worker() {
    while (jobs.length) {
      const j = jobs.shift();
      try {
        fs.writeFileSync(path.join(OUT, j.file), await generate(j.v, j.text));
      } catch (e) {
        errors[j.v.id] = e.message;
      }
      done++;
      process.stdout.write(`\r${done} clips done`);
    }
  }
  const total = jobs.length;
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(` (of ${total})`);
  for (const [id, msg] of Object.entries(errors)) console.log(`Variant ${id} failed: ${msg}`);

  // Side-by-side page: one row per word/sentence, one column per variant
  const cell = (i, v) => [1, 2].map((t) => {
    const f = `${String(i + 1).padStart(2, '0')}_${v.id}_take${t}.mp3`;
    return fs.existsSync(path.join(OUT, f)) ? `<audio controls preload="none" src="${f}"></audio>` : '<em>failed</em>';
  }).join('<br>');
  const html = `<!doctype html><meta charset="utf-8"><title>Audio lab</title>
<style>body{font-family:system-ui;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;vertical-align:top}
th{background:#f4f4f4;font-size:13px}td.t{font-size:26px;white-space:nowrap}audio{width:190px;height:32px}</style>
<h1>Audio lab</h1><p>Listen across each row. Note which column sounds clearest, least rushed, never cut off, and most alike between take 1 and take 2.</p>
<table><tr><th>Thai</th>${VARIANTS.map((v) => `<th>${v.id}<br>${v.label}</th>`).join('')}</tr>
${ITEMS.map((text, i) => `<tr><td class="t">${text}</td>${VARIANTS.map((v) => `<td>${cell(i, v)}</td>`).join('')}</tr>`).join('\n')}
</table>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`Open: ${path.join(OUT, 'index.html')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
