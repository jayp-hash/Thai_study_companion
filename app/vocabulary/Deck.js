'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const SET_SIZE = 20;
const SLOW_RATE = 0.75; // "Slow" button: 75% speed, same pitch

// Until words have categories (round 2), every card uses this band.
const DEFAULT_CATEGORY = { name: 'Vocabulary', color: '#4F5BD5', edge: '#353FA6' };

// ---------- Audio ----------
// One shared cache for the whole page: each clip is downloaded once per
// visit, so replays are instant and don't spend ElevenLabs credit.
const audioCache = new Map();

async function loadAudio(text) {
  if (audioCache.has(text)) return audioCache.get(text);
  // GET so the browser and Vercel's CDN can cache the clip (see api/speak)
  const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}`);
  if (!res.ok) throw new Error('speak request failed');
  const audio = new Audio(URL.createObjectURL(await res.blob()));
  audio.preservesPitch = true;
  audioCache.set(text, audio);
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

// Romanization setting: 'show' | 'tap' (hidden until tapped) | 'hide'.
// Remembered on this device. Later, with accounts, this can follow the
// learner's progress instead.
const ROMAN_KEY = 'tsc-romanization';
const ROMAN_MODES = [
  { id: 'show', label: 'Show' },
  { id: 'tap', label: 'On tap' },
  { id: 'hide', label: 'Hide' },
];

function useRomanMode() {
  const [mode, setMode] = useState('show');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROMAN_KEY);
      if (ROMAN_MODES.some((m) => m.id === saved)) setMode(saved);
    } catch {}
  }, []);
  const change = (m) => {
    setMode(m);
    try { localStorage.setItem(ROMAN_KEY, m); } catch {}
  };
  return [mode, change];
}

// Romanization that respects the setting. In "On tap" mode it shows a
// dotted placeholder that reveals the romanization when tapped.
function Roman({ text, mode, revealed, onReveal, className }) {
  if (!text || mode === 'hide') return null;
  if (mode === 'tap' && !revealed) {
    return (
      <button
        type="button"
        className={`fc-roman-hidden ${className || ''}`}
        aria-label="Show romanization"
        onClick={(e) => { e.stopPropagation(); onReveal(); }}
      >
        <span aria-hidden="true">• • •</span>
      </button>
    );
  }
  return <span className={className}>{text}</span>;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ---------- The deck ----------
export default function Deck({ words }) {
  const setCount = Math.ceil(words.length / SET_SIZE);
  const [setIndex, setSetIndex] = useState(0);
  const [order, setOrder] = useState(null); // null = normal order; array = shuffled
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [slow, setSlow] = useState(false);
  const player = usePlayer();
  const [romanMode, setRomanMode] = useRomanMode();
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
      setCardHeight(Math.round(Math.max(380, Math.min(620, window.innerHeight - top - 24))));
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
  const position = (order || words.slice(setIndex * SET_SIZE, setIndex * SET_SIZE + SET_SIZE))[cardIndex]?.position;
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
    () => words.slice(setIndex * SET_SIZE, setIndex * SET_SIZE + SET_SIZE),
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
  nextRef.current = next;
  goRef.current = go;

  // Keyboard: ← → to move, space to flip
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); flip(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, flip]);

  // Re-fit whenever the card, its size, or the romanization setting changes,
  // and once the fonts have loaded (they change the text's size).
  useLayoutEffect(() => { fit(); }, [fit, word, cardHeight, romanMode, revealed]);
  useEffect(() => {
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  if (!word) return <p className="deck-error">No words found.</p>;

  const cat = word.category || DEFAULT_CATEGORY;
  const catStyle = { '--cat': cat.color, '--cat-edge': cat.edge, '--cat-tint': hexToRgba(cat.color, 0.14) };
  const rate = slow ? SLOW_RATE : 1;
  const karaoke = player.playing === 'sentence' ? activeBox(sentence?.words, player.progress) : -1;
  const band = (
    <div className="fc-band">
      <span className="fc-band-cat">{cat.name}</span>
      <span className="fc-band-rank">#{word.position}</span>
    </div>
  );

  return (
    <div className="fc">
      <div className="fc-toolbar">
        <label className="fc-set">
          <span className="sr-only">Set</span>
          <select value={setIndex} onChange={(e) => chooseSet(Number(e.target.value))}>
            {Array.from({ length: setCount }, (_, i) => (
              <option key={i} value={i}>
                Set {i + 1} · words {i * SET_SIZE + 1}–{Math.min((i + 1) * SET_SIZE, words.length)}
              </option>
            ))}
          </select>
        </label>
        <div className="fc-progress" aria-hidden="true">
          <span style={{ width: `${((cardIndex + 1) / cards.length) * 100}%` }} />
        </div>
        <span className="fc-count">{cardIndex + 1} / {cards.length}</span>
        <button
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
        </button>
      </div>

      <div className="fc-settings" role="radiogroup" aria-label="Romanization">
        <span className="fc-settings-label">Romanization</span>
        <div className="fc-seg">
          {ROMAN_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={romanMode === m.id}
              className={romanMode === m.id ? 'is-on' : ''}
              onClick={() => { setRomanMode(m.id); setRevealed(new Set()); }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="fc-stage" ref={stageRef} style={cardHeight ? { '--fc-h': `${cardHeight}px` } : undefined}>
        <button type="button" className="fc-arrow prev" onClick={() => go(-1)} disabled={cardIndex === 0} aria-label="Previous card">
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
              <div className="fc-top">
                <div className="fc-word-line">
                  <span className="fc-word" lang="th">{word.thai}</span>
                  <span className="fc-word-roman">
                    <Roman text={word.romanization} mode={romanMode} revealed={isRevealed('back')} onReveal={() => reveal('back')} />
                  </span>
                </div>
                <div className="fc-meaning">{cleanMeaning(word.english)}</div>
              </div>

              <div className="fc-divider" />

              {sentence ? (
                <>
                  <div className="fc-label-row">
                    <PlayButton id="sentence" label="Play sentence" small player={player} onPlay={() => player.play('sentence', sentence.thai, rate)} />
                    <span className="fc-label">In a sentence</span>
                    <button
                      type="button"
                      className={`fc-slow${slow ? ' is-on' : ''}`}
                      aria-pressed={slow}
                      onClick={(e) => { e.stopPropagation(); setSlow((s) => !s); }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 15c0-4 3.5-7 8-7s7 3 7 6v1H3z" /><path d="M18 13h2a2 2 0 0 0 0-4h-1" /><path d="M6 15v3M15 15v3" />
                      </svg>
                      Slow
                    </button>
                  </div>
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
                          {romanMode === 'tap' && w.rom && !showRom && <span className="fc-box-rom is-hidden" aria-hidden="true">• • •</span>}
                        </button>
                      );
                    })}
                  </div>
                  {sentence.english && <div className="fc-english">{sentence.english}</div>}
                </>
              ) : (
                <p className="fc-soon">Example sentence coming soon</p>
              )}
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
