'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const SET_SIZE = 20;

// One shared audio cache for the whole page, so a word or sentence is only
// generated once per visit (saves ElevenLabs credit and makes replays instant).
const audioCache = new Map();

function PlayButton({ text, label, className = '' }) {
  const [state, setState] = useState('idle'); // idle | loading | playing

  async function play(e) {
    e.stopPropagation(); // don't flip the card when pressing play
    if (state === 'loading') return;
    try {
      let audio = audioCache.get(text);
      if (!audio) {
        setState('loading');
        // GET so the browser and Vercel's CDN can cache the clip (see api/speak)
        const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}`);
        if (!res.ok) throw new Error('speak request failed');
        audio = new Audio(URL.createObjectURL(await res.blob()));
        audioCache.set(text, audio);
      }
      audio.onplay = () => setState('playing');
      audio.onended = () => setState('idle');
      audio.currentTime = 0;
      await audio.play();
    } catch {
      setState('idle');
    }
  }

  return (
    <button
      type="button"
      className={`play-btn ${className}`}
      onClick={play}
      disabled={state === 'loading'}
      aria-label={label}
    >
      {state === 'loading' ? '…' : '🔊'}
    </button>
  );
}

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Deck({ words }) {
  const setCount = Math.ceil(words.length / SET_SIZE);
  const [setIndex, setSetIndex] = useState(0);
  const [order, setOrder] = useState(null); // null = normal order; array = shuffled
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const setWords = useMemo(
    () => words.slice(setIndex * SET_SIZE, setIndex * SET_SIZE + SET_SIZE),
    [words, setIndex]
  );
  const cards = order || setWords;
  const word = cards[cardIndex];

  const go = useCallback(
    (step) => {
      setFlipped(false);
      setCardIndex((i) => Math.min(Math.max(i + step, 0), cards.length - 1));
    },
    [cards.length]
  );

  function chooseSet(i) {
    setSetIndex(i);
    setOrder(null);
    setCardIndex(0);
    setFlipped(false);
  }

  function toggleShuffle() {
    setOrder((o) => (o ? null : shuffle(setWords)));
    setCardIndex(0);
    setFlipped(false);
  }

  // Keyboard: ← → to move, space to flip
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!word) return <p className="deck-error">No words found.</p>;

  const first = setIndex * SET_SIZE + 1;
  const last = Math.min(first + SET_SIZE - 1, words.length);

  return (
    <div className="deck">
      <div className="deck-toolbar">
        <label className="deck-set">
          <span>Set</span>
          <select value={setIndex} onChange={(e) => chooseSet(Number(e.target.value))}>
            {Array.from({ length: setCount }, (_, i) => (
              <option key={i} value={i}>
                {i + 1} · words {i * SET_SIZE + 1}–{Math.min((i + 1) * SET_SIZE, words.length)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={`deck-btn${order ? ' is-on' : ''}`} onClick={toggleShuffle}>
          {order ? 'Shuffled ✓' : 'Shuffle'}
        </button>
      </div>

      <div className={`deck-card${flipped ? ' is-flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="deck-card-inner">
          <div className="deck-face front">
            <span className="card-rank">#{word.position}</span>
            <PlayButton text={word.thai} label={`Play ${word.thai}`} />
            <div className="deck-thai">{word.thai}</div>
            <div className="card-roman">{word.romanization}</div>
            <span className="card-hint">tap or press space to flip</span>
          </div>

          <div className="deck-face back">
            <span className="card-rank">#{word.position}</span>
            <div className="deck-back-word">
              <span className="deck-back-thai">{word.thai}</span>
              <span className="deck-back-roman">{word.romanization}</span>
            </div>
            <div className="deck-english">{word.english}</div>

            {word.sentences.length > 0 ? (
              <div className="deck-examples">
                {word.sentences.map((s) => (
                  <div key={s.id} className="deck-example">
                    <PlayButton text={s.thai} label={`Play sentence ${s.thai}`} className="inline" />
                    <div>
                      <div className="ex-thai">{s.thai}</div>
                      {s.romanization && <div className="ex-roman">{s.romanization}</div>}
                      {s.english && <div className="ex-english">{s.english}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="deck-no-example">Example sentence coming soon</p>
            )}
          </div>
        </div>
      </div>

      <div className="deck-nav">
        <button type="button" className="deck-btn" onClick={() => go(-1)} disabled={cardIndex === 0}>
          ← Prev
        </button>
        <span className="deck-progress">
          Card {cardIndex + 1} of {cards.length}
          <small>words {first}–{last}</small>
        </span>
        <button
          type="button"
          className="deck-btn"
          onClick={() => (cardIndex === cards.length - 1 && setIndex < setCount - 1 ? chooseSet(setIndex + 1) : go(1))}
          disabled={cardIndex === cards.length - 1 && setIndex === setCount - 1}
        >
          {cardIndex === cards.length - 1 && setIndex < setCount - 1 ? 'Next set →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
