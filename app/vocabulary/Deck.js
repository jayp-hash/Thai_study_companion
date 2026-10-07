'use client';
import { useProgressStore, readStore, writeStore } from '../lib/progress';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const SET_SIZE = 20;
const SLOW_RATE = 0.65; // turtle button: 65% of the (already slightly slow) voice, same pitch

// Until words have categories (round 2), every card uses this band.
const DEFAULT_CATEGORY = { name: 'Vocabulary', color: '#4F5BD5', edge: '#353FA6' };

// ---------- Audio ----------
// One shared cache for the whole page: each clip is downloaded once per
// visit, so replays are instant and don't spend ElevenLabs credit.
const audioCache = new Map();

// Bump this when the voice settings change. Clips are cached for a year by
// the browser and Vercel, so a new number makes everyone get the new voice.
const AUDIO_VERSION = 2; // 2 = eleven_v4, stability 0.8, speed 0.85

// Female or male voice, from the Aa settings
let currentVoice = 'female';

async function loadAudio(text) {
  const key = `${currentVoice}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  // GET so the browser and Vercel's CDN can cache the clip (see api/speak)
  const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}&voice=${currentVoice}&v=${AUDIO_VERSION}`);
  if (!res.ok) throw new Error('speak request failed');
  const audio = new Audio(URL.createObjectURL(await res.blob()));
  audio.preservesPitch = true;
  audioCache.set(key, audio);
  return audio;
}

// Plays one clip at a time. `playing` says which button is active
// ('word', 'sentence' or 'box-3'), so the right one shows Stop.
function usePlayer() {
  const current = useRef(null);
  const frame = useRef(0);
  const [playing, setPlaying] = useState(null);
  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState(0); // 0..1 through the clip, for the karaoke

  const stop = useCallback(() => {
    const a = current.current;
    if (a) { a.pause(); a.onended = null; }
    cancelAnimationFrame(frame.current);
    current.current = null;
    setPlaying(null);
    setLoading(null);
    setProgress(0);
  }, []);

  const play = useCallback(async (id, text, rate = 1) => {
    if (current.current && playing === id) { stop(); return; } // pressing again = stop
    stop();
    setLoading(id);
    try {
      const audio = await loadAudio(text);
      audio.playbackRate = rate;
      audio.currentTime = 0;
      audio.onended = () => stop();
      current.current = audio;
      setLoading(null);
      setPlaying(id);
      await audio.play();
      // Track how far through the clip we are, every animation frame,
      // so the karaoke highlight moves smoothly.
      const tick = () => {
        if (current.current !== audio) return;
        if (audio.duration) setProgress(audio.currentTime / audio.duration);
        frame.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      stop();
    }
  }, [playing, stop]);

  useEffect(() => stop, [stop]);
  return { play, stop, playing, loading, progress };
}

// ---------- Small pieces ----------
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" /></svg>
);
const StopIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="5.5" y="5.5" width="13" height="13" rx="2.5" /></svg>
);

function PlayButton({ id, label, small, player, onPlay }) {
  const isPlaying = player.playing === id;
  const isLoading = player.loading === id;
  return (
    <button
      type="button"
      className={`fc-play${small ? ' sm' : ''}${isPlaying ? ' is-playing' : ''}`}
      aria-label={isPlaying ? 'Stop' : label}
      onClick={(e) => { e.stopPropagation(); onPlay(); }}
    >
      {isLoading ? <span className="fc-dots" aria-hidden="true">…</span> : isPlaying ? <StopIcon /> : <PlayIcon />}
    </button>
  );
}

// "that; which; at (relativizer)" → "that; which; at"
// Grammar labels in brackets don't help a learner.
const cleanMeaning = (m) => (m || '').replace(/\s*\([^)]*\)\s*$/, '');

// Rough karaoke until round 3 (exact timings from ElevenLabs):
// each word gets a share of the clip in proportion to its syllables.
function activeBox(words, progress) {
  if (!words || progress <= 0) return -1;
  const weights = words.map((w) => (w.rom || '').split(/[-\s]/).filter(Boolean).length + 0.6);
  const total = weights.reduce((a, b) => a + b, 0);
  // the voice starts a moment after the clip does
  const p = Math.min(Math.max((progress - 0.06) / 0.88, 0), 0.999);
  let acc = 0;
  for (let k = 0; k < weights.length; k++) {
    acc += weights[k] / total;
    if (p < acc) return k;
  }
  return weights.length - 1;
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- How much help each card gives ----------
// Help fades per card as the learner marks it "Got it":
//   level 0 (new / still learning): romanization + English shown
//   level 1 (got it 1–2 times):     English blurred until tapped
//   level 2 (got it 3–4 times):     romanization blurred too
//   level 3 (got it 5+ times):      romanization hidden, English blurred
// The English is never removed completely, so you can always check.
// "Auto" follows these levels; the learner can override either one.
// Saved on this device for now; with accounts it will follow the learner.
const SETTINGS_KEY = 'tsc-help';
const ROMAN_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'show', label: 'Show' },
  { id: 'tap', label: 'Blur' },
  { id: 'hide', label: 'Hide' },
];
const VOICE_OPTIONS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
];
const ENGLISH_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'show', label: 'Show' },
  { id: 'tap', label: 'Blur' },
];

function useHelpSettings() {
  const [settings, setSettings] = useState({ roman: 'auto', english: 'auto', voice: 'female' });
  useEffect(() => {
    const saved = readStore(SETTINGS_KEY, null);
    if (saved) setSettings((s) => ({ ...s, ...saved }));
  }, []);
  const change = (key, value) => setSettings((s) => {
    const next = { ...s, [key]: value };
    writeStore(SETTINGS_KEY, next);
    return next;
  });
  return [settings, change];
}

// One-time tips: shown on these cards until closed, then never again
const TIPS_KEY = 'tsc-tips-seen';
const TIPS = {
  'ครับ': 'Men end polite sentences with ครับ. Women use ค่ะ.',
  'ค่ะ': 'Women end polite sentences with ค่ะ (คะ in questions). Men use ครับ.',
  'ผม': 'ผม is "I" for men. Women usually say ฉัน.',
  'ฉัน': 'ฉัน is "I". Women use it most, men usually say ผม. The example sentences use ฉัน.',
};

const levelFor = (got = 0) => (got >= 5 ? 3 : got >= 3 ? 2 : got >= 1 ? 1 : 0);

// Romanization that respects the help level. "tap" = blurred until tapped.
function Roman({ text, mode, revealed, onReveal, className }) {
  if (!text || mode === 'hide') return null;
  if (mode === 'tap' && !revealed) {
    return (
      <button
        type="button"
        className={`fc-blur ${className || ''}`}
        aria-label="Show romanization"
        onClick={(e) => { e.stopPropagation(); onReveal(); }}
      >
        <span aria-hidden="true">{text}</span>
      </button>
    );
  }
  return <span className={className}>{text}</span>;
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="fc-panel-row">
      <span className="fc-panel-label">{label}</span>
      <div className="fc-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            className={value === o.id ? 'is-on' : ''}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------- The deck ----------
// session = the daily review: one list of cards, no sets or shuffle.
//   onRated(word, knewIt) -> return true if the word was put back in the queue
//   onDone() is called after rating the last card.
export default function Deck({ words, session = false, onRated, onDone }) {
  const size = session ? Math.max(words.length, 1) : SET_SIZE;
  const setCount = Math.ceil(words.length / size);
  const [setIndex, setSetIndex] = useState(0);
  const [order, setOrder] = useState(null); // null = normal order; array = shuffled
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const player = usePlayer();
  const [help, setHelp] = useHelpSettings();
  const { progress, rate: rateWord, reset: resetProgress } = useProgressStore();
  const [panelOpen, setPanelOpen] = useState(false);
  const [tipsSeen, setTipsSeen] = useState(() => new Set());
  useEffect(() => { setTipsSeen(new Set(readStore(TIPS_KEY, []))); }, []);
  const closeTip = (thai) => setTipsSeen((s) => {
    const next = new Set(s).add(thai);
    writeStore(TIPS_KEY, [...next]);
    return next;
  });
  currentVoice = help.voice || 'female';
  const panelRef = useRef(null);

  // Close the settings panel when tapping anywhere else
  useEffect(() => {
    if (!panelOpen) return;
    const close = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setPanelOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [panelOpen]);
  const [revealed, setRevealed] = useState(() => new Set()); // which romanizations were tapped open
  const [peek, setPeek] = useState(-1); // which word box shows its meaning bubble
  const [peekAlign, setPeekAlign] = useState('center'); // keeps the bubble inside the card
  const peekTimer = useRef(0);
  const hoverTimer = useRef(0);

  const reveal = (key) => setRevealed((r) => new Set(r).add(key));
  const isRevealed = (key) => revealed.has(key);

  // Meaning bubble: stays for 2.5 seconds after a tap
  const showPeek = (k, ms, el) => {
    clearTimeout(peekTimer.current);
    // Near the card's left or right edge, line the bubble up with that
    // edge of the word instead of centring it, so it never spills outside.
    if (el) {
      const face = el.closest('.fc-face').getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      setPeekAlign(mid - face.left < 120 ? 'left' : face.right - mid < 120 ? 'right' : 'center');
    }
    setPeek(k);
    peekTimer.current = ms ? setTimeout(() => { setPeek(-1); peekTimer.current = 0; }, ms) : 0;
  };
  // On a computer: rest the mouse on a word for half a second
  const hoverIn = (k, el) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => showPeek(k, 0, el), 500);
  };
  const hoverOut = () => {
    clearTimeout(hoverTimer.current);
    if (!peekTimer.current) setPeek(-1);
  };

  // Card height: the card fills the screen below the toolbar, the same
  // height for every word, so nothing ever needs scrolling to reach.
  const stageRef = useRef(null);
  const [cardHeight, setCardHeight] = useState(null);
  useLayoutEffect(() => {
    function measure() {
      if (!stageRef.current) return;
      const top = stageRef.current.getBoundingClientRect().top + window.scrollY;
      // On phones the back/next arrows sit in a row under the card
      const below = window.innerWidth <= 560 ? 72 : 24;
      setCardHeight(Math.round(Math.max(360, Math.min(620, window.innerHeight - top - below))));
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Swipe left / right on a touchscreen to change card
  const swipe = useRef(null);
  const swiped = useRef(false);
  const onPointerDown = (e) => {
    swiped.current = false;
    if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true; // so the tap that ends a swipe doesn't also flip the card
      dx < 0 ? nextRef.current() : goRef.current(-1);
    }
  };
  const nextRef = useRef(() => {});
  const goRef = useRef(() => {});

  // New card: hide bubbles and re-hide romanization
  const position = (order || words.slice(setIndex * size, setIndex * size + size))[cardIndex]?.position;
  useEffect(() => {
    setRevealed(new Set());
    setPeek(-1);
    clearTimeout(peekTimer.current);
    peekTimer.current = 0;
  }, [position]);
  useEffect(() => () => { clearTimeout(peekTimer.current); clearTimeout(hoverTimer.current); }, []);

  // Fit to the card: every card is the same size, so long content shrinks
  // to fit instead of being cut off.
  //  - Front: a long word (กุมภาพันธ์) gets a smaller font until it fits the width.
  //  - Back: everything scales down in small steps until nothing overflows.
  const bigThaiRef = useRef(null);
  const backBodyRef = useRef(null);
  const fit = useCallback(() => {
    const big = bigThaiRef.current;
    if (big) {
      big.style.fontSize = '';
      const room = big.clientWidth; // the width the word is allowed to use
      if (big.scrollWidth > room) {
        const size = parseFloat(getComputedStyle(big).fontSize);
        big.style.fontSize = `${Math.floor(size * room / big.scrollWidth)}px`;
      }
    }
    const back = backBodyRef.current;
    if (back) {
      let scale = 1;
      back.style.setProperty('--fc-s', '1');
      while (back.scrollHeight > back.clientHeight + 1 && scale > 0.7) {
        scale = Math.round((scale - 0.05) * 100) / 100;
        back.style.setProperty('--fc-s', String(scale));
      }
    }
  }, []);

  const setWords = useMemo(
    () => words.slice(setIndex * size, setIndex * size + size),
    [words, setIndex]
  );
  const cards = order || setWords;
  const word = cards[cardIndex];
  const sentence = word?.sentences?.[0];
  const isLastCard = cardIndex === cards.length - 1;
  const hasNextSet = setIndex < setCount - 1;

  const { stop } = player;
  const flip = useCallback((v) => { stop(); setFlipped((f) => (typeof v === 'boolean' ? v : !f)); }, [stop]);

  const go = useCallback(
    (step) => {
      stop();
      setFlipped(false);
      setCardIndex((i) => Math.min(Math.max(i + step, 0), cards.length - 1));
    },
    [cards.length, stop]
  );

  function chooseSet(i) {
    stop();
    setSetIndex(i);
    setOrder(null);
    setCardIndex(0);
    setFlipped(false);
  }

  function toggleShuffle() {
    stop();
    setOrder((o) => (o ? null : shuffle(setWords)));
    setCardIndex(0);
    setFlipped(false);
  }

  const next = () => (isLastCard && hasNextSet ? chooseSet(setIndex + 1) : go(1));
  // Back from the first card of a set goes to the last card of the set before
  const isFirstCard = cardIndex === 0;
  const prev = () => {
    if (isFirstCard && setIndex > 0) {
      stop();
      setSetIndex(setIndex - 1);
      setOrder(null);
      setCardIndex(size - 1);
      setFlipped(false);
    } else {
      go(-1);
    }
  };
  nextRef.current = next;
  goRef.current = (step) => (step < 0 ? prev() : go(step));

  // "Still learning" / "Got it": record it for this word, then go to the next card
  const rateCard = (knewIt) => {
    if (!word) return;
    rateWord(word.thai, knewIt);
    if (!session) { next(); return; }
    const requeued = onRated?.(word, knewIt);
    if (isLastCard && !requeued) { stop(); onDone?.(); return; }
    stop(); setFlipped(false); setCardIndex((i) => i + 1); // a re-queued card is appended, so i + 1 exists
  };
  const rateRef = useRef(rateCard);
  rateRef.current = rateCard;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  // Keyboard: ← → to move, space to flip
  useEffect(() => {
    // Arrow keys always move between cards, even if a button was clicked
    // last (it loses focus, so it doesn't stay highlighted). Only the set
    // dropdown keeps its arrow keys. Space flips the card unless a button is
    // focused, where space presses that button as usual.
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      const move = (fn) => { e.preventDefault(); if (tag === 'BUTTON') e.target.blur(); fn(); };
      if (e.key === 'ArrowRight') move(() => nextRef.current());
      else if (e.key === 'ArrowLeft') move(() => goRef.current(-1));
      else if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); flip(); }
      else if (flippedRef.current && (e.key === '1' || e.key === '2')) move(() => rateRef.current(e.key === '2'));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, flip]);

  // Re-fit whenever the card, its size, or the romanization setting changes,
  // and once the fonts have loaded (they change the text's size).
  useLayoutEffect(() => { fit(); }, [fit, word, cardHeight, help, progress, revealed, tipsSeen]);
  useEffect(() => {
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  if (!word) return <p className="deck-error">No words found.</p>;

  const cat = word.category || DEFAULT_CATEGORY;
  const catStyle = { '--cat': cat.color, '--cat-edge': cat.edge, '--cat-tint': hexToRgba(cat.color, 0.14) };
  const rate = 1; // words and word boxes always play at normal speed
  const level = levelFor(progress[word.thai]?.got);
  const romanMode = help.roman === 'auto' ? (level >= 3 ? 'hide' : level >= 2 ? 'tap' : 'show') : help.roman;
  const englishMode = help.english === 'auto' ? (level >= 1 ? 'tap' : 'show') : help.english;
  const karaoke = player.playing === 'sentence' || player.playing === 'sentence-slow'
    ? activeBox(sentence?.words, player.progress) : -1;
  const band = (
    <div className="fc-band">
      <span className="fc-band-cat">{cat.name}</span>
      <span className="fc-band-right">
        <span className="fc-level" role="img" aria-label={`How well you know it: ${level} of 3`}>
          {[1, 2, 3].map((i) => <i key={i} className={i <= level ? 'on' : ''} />)}
        </span>
        <span className="fc-band-rank">#{word.position}</span>
      </span>
    </div>
  );

  return (
    <div className="fc">
      <div className="fc-toolbar">
        {!session && <label className="fc-set">
          <span className="sr-only">Set</span>
          <select value={setIndex} onChange={(e) => chooseSet(Number(e.target.value))}>
            {Array.from({ length: setCount }, (_, i) => (
              <option key={i} value={i}>
                Set {i + 1} · words {i * size + 1}–{Math.min((i + 1) * size, words.length)}
              </option>
            ))}
          </select>
        </label>}
        <div className="fc-progress" aria-hidden="true">
          <span style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }} />
        </div>
        <span className="fc-count">{cardIndex + 1} / {cards.length}</span>
        {!session && <button
          type="button"
          className={`fc-shuffle${order ? ' is-on' : ''}`}
          onClick={toggleShuffle}
          aria-pressed={!!order}
          aria-label="Shuffle this set"
          title="Shuffle this set"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </button>}
        <div className="fc-aa-wrap" ref={panelRef}>
          <button
            type="button"
            className={`fc-aa${panelOpen ? ' is-on' : ''}`}
            aria-expanded={panelOpen}
            aria-label="Help settings: romanization and English"
            title="Romanization and English"
            onClick={() => setPanelOpen((o) => !o)}
          >
            Aa
          </button>
          {panelOpen && (
            <div className="fc-panel" role="dialog" aria-label="Help settings">
              <Segmented label="Voice" options={VOICE_OPTIONS} value={help.voice} onChange={(v) => { player.stop(); setHelp('voice', v); }} />
              <Segmented label="Romanization" options={ROMAN_OPTIONS} value={help.roman} onChange={(v) => { setHelp('roman', v); setRevealed(new Set()); }} />
              <Segmented label="English sentence" options={ENGLISH_OPTIONS} value={help.english} onChange={(v) => { setHelp('english', v); setRevealed(new Set()); }} />
              <p className="fc-panel-note">Auto gives less help on a card each time you mark it &ldquo;Got it&rdquo;.</p>
              <button type="button" className="fc-panel-reset" onClick={() => { resetProgress(); setRevealed(new Set()); }}>
                Reset my progress
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fc-stage" ref={stageRef} style={cardHeight ? { '--fc-h': `${cardHeight}px` } : undefined}>
        <button type="button" className="fc-arrow prev" onClick={prev} disabled={isFirstCard && setIndex === 0} aria-label={isFirstCard && setIndex > 0 ? 'Previous set' : 'Previous card'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      <div className="fc-zone">
        <div
          className={`fc-card${flipped ? ' is-flipped' : ''}`}
          style={catStyle}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={() => { if (!swiped.current) flip(); swiped.current = false; }}
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${word.thai}, ${cleanMeaning(word.english)}. Press to flip back.` : `${word.thai}. Press to see the meaning.`}
          onKeyDown={(e) => { if (e.key === 'Enter') flip(); }}
        >
          {/* FRONT: the word */}
          <section className="fc-face fc-front" aria-hidden={flipped}>
            {band}
            <div className="fc-front-body">
              <div ref={bigThaiRef} className={`fc-big-thai${player.playing === 'word' ? ' is-speaking' : ''}`} lang="th">{word.thai}</div>
              <div className="fc-big-roman">
                <Roman text={word.romanization} mode={romanMode} revealed={isRevealed('front')} onReveal={() => reveal('front')} />
              </div>
              <PlayButton id="word" label={`Play ${word.thai}`} player={player} onPlay={() => player.play('word', word.thai, rate)} />
            </div>
          </section>

          {/* BACK: meaning + one sample sentence */}
          <section className="fc-face fc-back" aria-hidden={!flipped}>
            {band}
            <div className="fc-back-body" ref={backBodyRef}>
              {/* Top: sentence play + slow on the left, the word and its meaning beside them */}
              <div className={`fc-top${sentence ? ' has-controls' : ''}`}>
                {sentence && (
                <div className="fc-ex-controls">
                  <PlayButton id="sentence" label="Play sentence" small player={player} onPlay={() => player.play('sentence', sentence.thai, 1)} />
                  <button
                    type="button"
                    className={`fc-turtle${player.playing === 'sentence-slow' ? ' is-playing' : ''}`}
                    aria-label={player.playing === 'sentence-slow' ? 'Stop' : 'Play sentence slowly'}
                    title="Play slowly"
                    onClick={(e) => { e.stopPropagation(); player.play('sentence-slow', sentence.thai, SLOW_RATE); }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 15c0-4 3.5-7 8-7s7 3 7 6v1H3z" /><path d="M18 13h2a2 2 0 0 0 0-4h-1" /><path d="M6 15v3M15 15v3" />
                    </svg>
                  </button>
                </div>
                )}
                <div className="fc-top-text">
                <div className="fc-word-line">
                  <span className="fc-word" lang="th">{word.thai}</span>
                  <span className="fc-word-roman">
                    <Roman text={word.romanization} mode={romanMode} revealed={isRevealed('back')} onReveal={() => reveal('back')} />
                  </span>
                </div>
                <div className="fc-meaning">{cleanMeaning(word.english)}</div>
                </div>
              </div>

              <div className="fc-divider" />

              {sentence ? (
                <>
                  <div className={`fc-sentence${(sentence.words || []).length > 6 ? ' is-long' : ''}`} lang="th">
                    {(sentence.words || [{ th: sentence.thai, rom: sentence.romanization }]).map((w, k) => {
                      const id = `box-${k}`;
                      const isTarget = w.th === word.thai;
                      const isOn = karaoke === k || player.playing === id;
                      // In "On tap" mode, tapping a box also reveals its romanization
                      const showRom = w.rom && (romanMode === 'show' || (romanMode === 'tap' && isRevealed(id)));
                      return (
                        <button
                          key={k}
                          type="button"
                          className={`fc-box${isTarget ? ' is-target' : ''}${isOn ? ' is-on' : ''}`}
                          aria-label={`Play ${w.th}${w.en ? `, meaning ${w.en}` : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            player.play(id, w.th, rate);
                            if (romanMode === 'tap') reveal(id);
                            if (w.en) showPeek(k, 2500, e.currentTarget);
                          }}
                          onPointerEnter={(e) => e.pointerType === 'mouse' && w.en && hoverIn(k, e.currentTarget)}
                          onPointerLeave={(e) => e.pointerType === 'mouse' && hoverOut()}
                        >
                          {peek === k && w.en && <span className={`fc-peek align-${peekAlign}`} role="tooltip">{w.en}</span>}
                          <span className="fc-box-th">{w.th}</span>
                          {showRom && <span className="fc-box-rom">{w.rom}</span>}
                          {romanMode === 'tap' && w.rom && !showRom && <span className="fc-box-rom fc-blur-text" aria-hidden="true">{w.rom}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {TIPS[word.thai] && !tipsSeen.has(word.thai) && (
                    <div className="fc-tip" role="note">
                      <span>{TIPS[word.thai]}</span>
                      <button type="button" aria-label="Close tip" onClick={(e) => { e.stopPropagation(); closeTip(word.thai); }}>×</button>
                    </div>
                  )}
                  {sentence.english && (englishMode === 'tap' && !isRevealed('english') ? (
                    <button
                      type="button"
                      className="fc-english fc-blur"
                      aria-label="Show the English translation"
                      onClick={(e) => { e.stopPropagation(); reveal('english'); }}
                    >
                      <span aria-hidden="true">{sentence.english}</span>
                    </button>
                  ) : (
                    <div className="fc-english">{sentence.english}</div>
                  ))}
                </>
              ) : (
                <p className="fc-soon">Example sentence coming soon</p>
              )}
            </div>
            <div className="fc-rate">
              <button type="button" className="fc-rate-btn again" onClick={(e) => { e.stopPropagation(); rateCard(false); }}>
                Still learning
              </button>
              <button type="button" className="fc-rate-btn got" onClick={(e) => { e.stopPropagation(); rateCard(true); }}>
                Got it
              </button>
            </div>
          </section>
        </div>
      </div>

        <button
          type="button"
          className="fc-arrow next"
          onClick={next}
          disabled={isLastCard && !hasNextSet}
          aria-label={isLastCard && hasNextSet ? 'Next set' : 'Next card'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
