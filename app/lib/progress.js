'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from './supabase-browser';
import { useUser } from './useUser';

// ---------------------------------------------------------------------
// Learning progress, shared by the Today session and the full deck.
//
// Always saved in this browser (works without an account). When signed
// in, also saved to the account so it follows you to other devices.
//
// progress = { "ที่": { got: 3, seen, due, intro }, ... }   (times in ms)
//   got   = "Got it" presses in a row (Still learning resets it to 0)
//   seen  = last time you rated it
//   due   = when it should come back for review
//   intro = the first time you studied it (used to count new words per day)
// days = { "2026-10-07": { reviewed: 14, done: true }, ... }
// ---------------------------------------------------------------------

export const PROGRESS_KEY = 'tsc-progress';
const DAYS_KEY = 'tsc-days';
const GOAL_KEY = 'tsc-goal';
export const GOAL_OPTIONS = [5, 10, 15, 20, 30];
export const DEFAULT_GOAL = 10;

const DAY = 24 * 60 * 60 * 1000;
// Spaced repetition: each "Got it" in a row waits longer before the word comes back.
const INTERVAL_DAYS = [1, 3, 7, 14, 30, 60];
const intervalFor = (got) => (got <= 0 ? 0 : INTERVAL_DAYS[Math.min(got, INTERVAL_DAYS.length) - 1] * DAY);

export const readStore = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
export const writeStore = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// "2026-10-07" in the learner's own time zone
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Fill in fields that older saved progress doesn't have yet
const normalise = (v) => {
  const seen = v.seen || Date.now();
  return { got: v.got || 0, seen, due: v.due ?? seen + intervalFor(v.got || 0), intro: v.intro || seen };
};
const normaliseAll = (p) => Object.fromEntries(Object.entries(p || {}).map(([k, v]) => [k, normalise(v)]));

const iso = (t) => new Date(t).toISOString();
const toRow = (userId, thai, v) => ({ user_id: userId, thai, got: v.got, seen: iso(v.seen), due: iso(v.due), introduced_at: iso(v.intro) });
const fromRow = (r) => normalise({ got: r.got, seen: Date.parse(r.seen), due: r.due ? Date.parse(r.due) : undefined, intro: r.introduced_at ? Date.parse(r.introduced_at) : undefined });

async function loadAll(db, table, select) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

// --- Streak: days in a row with the daily review finished -------------
export function streakFrom(days) {
  let t = Date.now();
  if (!days[dayKey(t)]?.done) t -= DAY; // today not finished yet: count up to yesterday
  let n = 0;
  while (days[dayKey(t)]?.done) { n++; t -= DAY; }
  return n;
}

// --- "Everyday Thai you understand" (an estimate) ---------------------
// Word use follows Zipf's law: the word at frequency rank r turns up about
// 1/r as often as the most common word. So the share of everyday Thai you
// can follow ≈ sum of 1/rank for the words you know, divided by the same
// sum over an everyday vocabulary of ~10,000 words.
const EVERYDAY_VOCAB = 10000;
let H = 0; for (let r = 1; r <= EVERYDAY_VOCAB; r++) H += 1 / r;
export function coverage(words, progress, extraKnown) {
  let sum = 0;
  for (const w of words) {
    const known = (progress[w.thai]?.got || 0) >= 1 || extraKnown?.has(w.thai);
    if (!known) continue;
    const rank = w.frequencyRank > 0 ? w.frequencyRank : 2000 + w.position; // unranked words count as rare
    sum += 1 / rank;
  }
  return Math.min(sum / H, 0.99);
}

// --- The shared state --------------------------------------------------
const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState({});
  const [days, setDays] = useState({});
  const [goal, setGoalState] = useState(DEFAULT_GOAL);
  const [loaded, setLoaded] = useState(false);
  const { user } = useUser();
  const userId = user?.id;

  useEffect(() => {
    setProgress(normaliseAll(readStore(PROGRESS_KEY, {})));
    setDays(readStore(DAYS_KEY, {}));
    setGoalState(readStore(GOAL_KEY, DEFAULT_GOAL));
    setLoaded(true);
  }, []);

  // Signed in: merge this browser with the account (most recent wins per word)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const db = supabaseBrowser();
      try {
        const rows = await loadAll(db, 'word_progress', 'thai, got, seen, due, introduced_at');
        const remote = Object.fromEntries(rows.map((r) => [r.thai, fromRow(r)]));
        const local = normaliseAll(readStore(PROGRESS_KEY, {}));
        const merged = { ...remote };
        const upload = [];
        for (const [thai, v] of Object.entries(local)) {
          if (!remote[thai] || v.seen > remote[thai].seen) { merged[thai] = v; upload.push(toRow(userId, thai, v)); }
        }
        for (let i = 0; i < upload.length; i += 500) {
          const { error } = await db.from('word_progress').upsert(upload.slice(i, i + 500));
          if (error) throw error;
        }

        const dayRows = await loadAll(db, 'study_days', 'day, reviewed, done');
        const localDays = readStore(DAYS_KEY, {});
        const mergedDays = { ...localDays };
        for (const r of dayRows) {
          const l = localDays[r.day];
          mergedDays[r.day] = { reviewed: Math.max(r.reviewed, l?.reviewed || 0), done: r.done || !!l?.done };
        }
        const dayUpload = Object.entries(mergedDays).map(([day, v]) => ({ user_id: userId, day, reviewed: v.reviewed || 0, done: !!v.done }));
        if (dayUpload.length) await db.from('study_days').upsert(dayUpload);

        const { data: profile } = await db.from('profiles').select('new_per_day').eq('id', userId).maybeSingle();

        if (!cancelled) {
          writeStore(PROGRESS_KEY, merged); setProgress(merged);
          writeStore(DAYS_KEY, mergedDays); setDays(mergedDays);
          if (profile?.new_per_day) { writeStore(GOAL_KEY, profile.new_per_day); setGoalState(profile.new_per_day); }
        }
      } catch (e) {
        console.warn('Could not sync progress', e);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const save = (table, row) => {
    if (!userId) return;
    supabaseBrowser().from(table).upsert(row).then(({ error }) => { if (error) console.warn(`Could not save ${table}`, error); });
  };

  const bumpDay = (patch) => setDays((d) => {
    const k = dayKey();
    const cur = d[k] || { reviewed: 0, done: false };
    const v = patch(cur);
    const next = { ...d, [k]: v };
    writeStore(DAYS_KEY, next);
    save('study_days', { user_id: userId, day: k, reviewed: v.reviewed, done: v.done });
    return next;
  });

  const rate = (thai, knewIt) => {
    setProgress((p) => {
      const now = Date.now();
      const got = knewIt ? (p[thai]?.got || 0) + 1 : 0; // "Still learning" = full help again
      const entry = { got, seen: now, due: now + intervalFor(got), intro: p[thai]?.intro || now };
      const next = { ...p, [thai]: entry };
      writeStore(PROGRESS_KEY, next);
      save('word_progress', toRow(userId, thai, entry));
      return next;
    });
    bumpDay((cur) => ({ ...cur, reviewed: cur.reviewed + 1 }));
  };

  const finishToday = () => bumpDay((cur) => ({ ...cur, done: true }));

  const reset = () => {
    writeStore(PROGRESS_KEY, {}); setProgress({});
    if (userId) supabaseBrowser().from('word_progress').delete().eq('user_id', userId)
      .then(({ error }) => { if (error) console.warn('Could not reset progress', error); });
  };

  const setGoal = (n) => {
    writeStore(GOAL_KEY, n); setGoalState(n);
    if (userId) supabaseBrowser().from('profiles').update({ new_per_day: n }).eq('id', userId)
      .then(({ error }) => { if (error) console.warn('Could not save goal', error); });
  };

  const value = useMemo(() => ({
    progress, days, goal, loaded, rate, reset, finishToday, setGoal,
    streak: streakFrom(days),
    newToday: Object.values(progress).filter((v) => v.intro >= startOfToday()).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [progress, days, goal, loaded, userId]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgressStore() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressStore must be inside <ProgressProvider>');
  return ctx;
}
