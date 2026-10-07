'use client';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

// First-time tutorial for the flashcards. Each step spotlights one part of
// the card (found by its data-tour="..." attribute) with a navy bubble.
// Steps whose target isn't on screen (e.g. a card with no sentence) are skipped.
// side: 'front' / 'back' flips the card first so the right part is visible.
export const TOUR_KEY = 'tsc-tour-vocab';

export function tourSteps({ session }) {
  return [
    { target: 'card', side: 'front', title: 'One word per card', text: 'Tap the card, or press Space, to flip it over.' },
    { target: 'play', side: 'front', title: 'Hear it', text: 'Tap play to hear the word.' },
    { target: 'words', side: 'back', title: 'See it in a sentence', text: 'The back uses the word in a short sentence. Tap any word to hear it and see what it means.' },
    { target: 'slow', side: 'back', title: 'Too fast?', text: 'The turtle plays the sentence slowly.' },
    { target: 'rate', side: 'back', title: 'Be honest', text: '"Got it" means you\'ll see the card less often, with less help. "Still learning" brings it back sooner.' },
    ...(session ? [] : [{ target: 'arrows', side: 'front', title: 'Move around', text: 'Swipe, or use the arrows and arrow keys, to go between cards.' }]),
    { target: 'settings', title: 'Your settings', text: 'Change the voice, or how much romanization and English you see.' },
    { target: 'help', title: "That's it!", text: 'Tap ? any time to see this tour again.' },
  ];
}

const PAD = 8;

export default function Tour({ steps, onClose, setSide }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    const r = el?.getBoundingClientRect();
    setRect(r && r.width > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 } : null);
    return !!(r && r.width > 0);
  }, [step]);

  // Flip the card if needed, wait for the flip, then find the target.
  useLayoutEffect(() => {
    setRect(null);
    if (step.side) setSide(step.side);
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      if (!measure()) setI((n) => (n < steps.length - 1 ? n + 1 : n)); // nothing to show: skip ahead
    }, step.side ? 560 : 60);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const re = () => measure();
    window.addEventListener('resize', re);
    window.addEventListener('scroll', re, true);
    return () => { window.removeEventListener('resize', re); window.removeEventListener('scroll', re, true); };
  }, [measure]);

  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Bubble below the spotlight if there's room, otherwise above it
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const bw = Math.min(320, vw - 32);
  let bubble = { left: 16, top: vh / 2 - 80, width: bw };
  if (rect) {
    const below = rect.top + rect.height + 14;
    const top = below + 190 < vh ? below : Math.max(16, rect.top - 14 - 190);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - bw / 2), vw - bw - 16);
    bubble = { left, top, width: bw };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" onClick={(e) => e.stopPropagation()}>
      {rect
        ? <div className="tour-spot" style={rect} />
        : <div className="tour-dim" />}
      <div className="tour-bubble" style={bubble}>
        <div className="tour-dots" aria-label={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={onClose}>Skip tour</button>}
          <span className="tour-spacer" />
          {i > 0 && <button type="button" className="tour-back" onClick={back}>Back</button>}
          <button type="button" className="tour-next" onClick={next} autoFocus>{last ? 'Start learning' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
