'use client';
import { useMemo, useRef, useState } from 'react';
import Deck from '../vocabulary/Deck';
import { useProgressStore, coverage, endOfToday, GOAL_OPTIONS } from '../lib/progress';
import { useUser } from '../lib/useUser';

const MAX_REVIEWS = 100;   // never more than this many reviews in one day
const EXTRA_NEW = 5;       // "Learn 5 more"
const MAX_REPEATS = 2;     // "Still learning" brings a card back at most twice per session

const pct = (x) => `${Math.round(x * 100)}%`;

function Flame() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#F08A1C" d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />
    </svg>
  );
}

function Meter({ value, from }) {
  return (
    <div className="today-meter">
      <div className="today-meter-top">
        <span>Everyday Thai you understand</span>
        <b>{pct(value)}</b>
      </div>
      <div className="today-bar" role="img" aria-label={`About ${pct(value)}`}>
        {from != null && <i className="was" style={{ width: pct(from) }} />}
        <i style={{ width: pct(value) }} />
      </div>
      <p className="today-note">An estimate, based on how often Thai people use each word you know.</p>
    </div>
  );
}

export default function Today({ words }) {
  const store = useProgressStore();
  const { progress, goal, setGoal, streak, newToday, loaded, finishToday } = store;
  const { user, ready } = useUser();
  const [mode, setMode] = useState('home'); // home | session | done
  const [queue, setQueue] = useState([]);
  const [before, setBefore] = useState(0);
  const repeats = useRef(new Map());
  const reviewedInSession = useRef(0);

  // What's waiting today
  const plan = useMemo(() => {
    const cutoff = endOfToday();
    const due = words
      .filter((w) => progress[w.thai] && progress[w.thai].due <= cutoff)
      .sort((a, b) => progress[a.thai].due - progress[b.thai].due)
      .slice(0, MAX_REVIEWS);
    const fresh = words.filter((w) => !progress[w.thai]);
    const newLeft = Math.max(goal - newToday, 0);
    return { due, fresh, newLeft, newCards: fresh.slice(0, newLeft) };
  }, [words, progress, goal, newToday]);

  const known = useMemo(() => coverage(words, progress), [words, progress]);

  const start = (cards) => {
    repeats.current = new Map();
    reviewedInSession.current = 0;
    setBefore(known);
    setQueue(cards);
    setMode('session');
    window.scrollTo(0, 0);
  };

  // "Still learning": the card comes back later in this session
  const onRated = (word, knewIt) => {
    reviewedInSession.current += 1;
    if (knewIt) return false;
    const n = repeats.current.get(word.thai) || 0;
    if (n >= MAX_REPEATS) return false;
    repeats.current.set(word.thai, n + 1);
    setQueue((q) => [...q, word]);
    return true;
  };

  const onDone = () => { finishToday(); setMode('done'); window.scrollTo(0, 0); };

  if (!loaded) return <div className="today-wrap"><p className="today-note">Loading…</p></div>;

  if (mode === 'session') {
    return (
      <>
        <div className="fc-page-title">
          <h1>Today</h1>
          <button type="button" className="today-quit" onClick={() => setMode('home')}>End session</button>
        </div>
        <Deck words={queue} session onRated={onRated} onDone={onDone} />
      </>
    );
  }

  const nothingLeft = plan.due.length === 0 && plan.newCards.length === 0;
  const signedOut = ready && !user;

  return (
    <div className="today-wrap">
      {mode === 'done' ? (
        <div className="today-card today-done">
          <p className="today-eyebrow">Session complete</p>
          <h1 className="today-title">Nice work!</h1>
          <div className="today-stats">
            <div><b>{reviewedInSession.current}</b><span>cards studied</span></div>
            <div><b className="flame"><Flame />{streak}</b><span>day streak</span></div>
          </div>
          <Meter value={known} from={before} />
          <div className="today-actions">
            {plan.fresh.length > 0 && (
              <button type="button" className="auth-btn primary" onClick={() => start(plan.fresh.slice(0, EXTRA_NEW))}>Learn {EXTRA_NEW} more words</button>
            )}
            <a className="auth-btn google" href="/vocabulary">Browse all words</a>
          </div>
        </div>
      ) : (
        <div className="today-card">
          <div className="today-head">
            <h1 className="today-title">Today</h1>
            <span className="today-streak" title="Days in a row you finished your review"><Flame />{streak} day{streak === 1 ? '' : 's'}</span>
          </div>

          <Meter value={known} />

          {nothingLeft ? (
            <div className="today-due">
              <div><strong>All done for today</strong><span>Come back tomorrow to keep your streak going.</span></div>
              {plan.fresh.length > 0 && (
                <button type="button" className="auth-btn primary" onClick={() => start(plan.fresh.slice(0, EXTRA_NEW))}>Learn {EXTRA_NEW} more</button>
              )}
            </div>
          ) : (
            <div className="today-due">
              <div>
                <strong>{plan.due.length} to review · {plan.newCards.length} new</strong>
                <span>About {Math.max(1, Math.round((plan.due.length * 10 + plan.newCards.length * 25) / 60))} minutes</span>
              </div>
              <button type="button" className="auth-btn primary" onClick={() => start([...plan.due, ...plan.newCards])}>Start</button>
            </div>
          )}

          <div className="today-goal">
            <span id="goal-label">Learning goal: new words a day</span>
            <div className="fc-seg" role="radiogroup" aria-labelledby="goal-label">
              {GOAL_OPTIONS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={goal === n} className={goal === n ? 'is-on' : ''} onClick={() => setGoal(n)}>{n}</button>
              ))}
            </div>
          </div>

          {signedOut && (
            <p className="today-note">Your progress is saved in this browser. <a href="/signin">Sign in</a> to keep your streak on every device.</p>
          )}
        </div>
      )}
    </div>
  );
}
