'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

      <div className="fc-zone">
        <div
          className={`fc-card${flipped ? ' is-flipped' : ''}`}
          style={catStyle}
          onClick={() => flip()}
          role="button"
          tabIndex={0}
          aria-label={flipped ? `${word.thai}, ${cleanMeaning(word.english)}. Press to flip back.` : `${word.thai}. Press to see the meaning.`}
          onKeyDown={(e) => { if (e.key === 'Enter') flip(); }}
        >
          {/* FRONT: the word */}
          <section className="fc-face fc-front" aria-hidden={flipped}>
            {band}
            <div className="fc-front-body">
              <div className={`fc-big-thai${player.playing === 'word' ? ' is-speaking' : ''}`} lang="th">{word.thai}</div>
              <div className="fc-big-roman">{word.romanization}</div>
              <PlayButton id="word" label={`Play ${word.thai}`} player={player} onPlay={() => player.play('word', word.thai, rate)} />
            </div>
          </section>

          {/* BACK: meaning + one sample sentence */}
          <section className="fc-face fc-back" aria-hidden={!flipped}>
            {band}
            <div className="fc-back-body">
              <div className="fc-top">
                <div className="fc-word" lang="th">{word.thai}</div>
                <div className="fc-word-roman">{word.romanization}</div>
                <div className="fc-meaning">{cleanMeaning(word.english)}</div>
              </div>

              <div className="fc-divider" />

              {sentence ? (
                <>
                  <div className="fc-label">In a sentence</div>
                  <div className="fc-sentence" lang="th">
                    {(sentence.words || [{ th: sentence.thai, rom: sentence.romanization }]).map((w, k) => {
                      const id = `box-${k}`;
                      const isTarget = w.th === word.thai;
                      const isOn = karaoke === k || player.playing === id;
                      return (
                        <button
                          key={k}
                          type="button"
                          className={`fc-box${isTarget ? ' is-target' : ''}${isOn ? ' is-on' : ''}`}
                          aria-label={`Play ${w.rom || w.th}`}
                          onClick={(e) => { e.stopPropagation(); player.play(id, w.th, rate); }}
                        >
                          <span className="fc-box-th">{w.th}</span>
                          {w.rom && <span className="fc-box-rom">{w.rom}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {sentence.english && <div className="fc-english">{sentence.english}</div>}
                  <div className="fc-controls">
                    <PlayButton id="sentence" label="Play sentence" small player={player} onPlay={() => player.play('sentence', sentence.thai, rate)} />
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
                </>
              ) : (
                <p className="fc-soon">Example sentence coming soon</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="fc-nav">
        <button type="button" className="fc-btn" onClick={() => go(-1)} disabled={cardIndex === 0} aria-label="Previous card">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <button type="button" className="fc-btn primary" onClick={() => flip()}>
          {flipped ? 'Show word' : 'Flip'}
        </button>
        <button type="button" className="fc-btn" onClick={next} disabled={isLastCard && !hasNextSet} aria-label={isLastCard && hasNextSet ? 'Next set' : 'Next card'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
