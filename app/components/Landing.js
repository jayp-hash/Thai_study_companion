'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '../lib/useUser';
import SoiSign from './SoiSign';

// The home page for new visitors. The pitch changes with who's visiting
// (live in Thailand / Thai partner / visiting); the choice is remembered
// in this browser (later: saved to the profile and used to tailor the course).
const PERSONA_KEY = 'tsc-persona';
const AUDIO_VERSION = 2; // keep in step with Deck.js

const PERSONAS = {
  live: {
    chip: 'I live in Thailand',
    h1: <>Thai for the street <span className="lp-th">you live on</span></>,
    lede: 'Order food, give the taxi directions and sort things out with the condo office. Learn the words people around you actually use, most useful first.',
  },
  partner: {
    chip: 'My partner is Thai',
    h1: <>Talk with their family, <span className="lp-th">not just smile and nod</span></>,
    lede: 'Follow the conversation at dinner, say the right thing to their parents and surprise your partner. Start with the everyday Thai families really speak.',
  },
  visit: {
    chip: "I'm visiting",
    h1: <>Survival Thai <span className="lp-th">before you land</span></>,
    lede: 'Greet people, ask where things are and pay at the market. The most useful words come first, so a few days of practice already helps.',
  },
};

const MISSIONS = {
  live: [['7-Eleven', 'ไม่เอาถุง', "Tell the cashier you don't need a bag."], ['Taxi', 'ไปสุขุมวิท', "Tell the driver where you're going."], ['Street food', 'ไม่เผ็ด', 'Order your dish not spicy.']],
  partner: [['Dinner', 'อร่อยมาก', 'Tell their mum the food is delicious.'], ['Greeting', 'สวัสดี', 'Greet their parents with a wai.'], ['At home', 'กินข้าวหรือยัง', "Ask someone if they've eaten yet."]],
  visit: [['Market', 'เท่าไหร่', 'Ask how much something costs.'], ['Restaurant', 'เช็คบิลด้วย', 'Ask for the bill.'], ['Hotel', 'ขอบคุณ', 'Thank the staff in Thai.']],
};

const clean = (m) => (m || '').replace(/\s*\([^)]*\)\s*$/, '');

function usePlay() {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(null);
  const play = (id, text) => {
    try {
      audio.current?.pause();
      const a = new Audio(`/api/speak?text=${encodeURIComponent(text)}&voice=female&v=${AUDIO_VERSION}`);
      audio.current = a;
      setPlaying(id);
      a.onended = a.onerror = () => setPlaying((p) => (p === id ? null : p));
      a.play().catch(() => setPlaying(null));
    } catch { setPlaying(null); }
  };
  return { play, playing };
}

const PlayIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;

function DemoCard({ card }) {
  const [flipped, setFlipped] = useState(false);
  const { play, playing } = usePlay();
  useEffect(() => setFlipped(false), [card.thai]);
  const s = card.sentence;
  const style = { '--cat': card.category.color, '--cat-edge': card.category.edge };
  const band = (
    <div className="lp-band"><span>{card.category.name}</span><span>#{card.position}</span></div>
  );
  return (
    <div className="lp-stage">
      <div className={`lp-card${flipped ? ' is-flipped' : ''}`} style={style} role="button" tabIndex={0}
        aria-label={flipped ? 'Flip the card back' : `${card.thai}. Tap to see the meaning.`}
        onClick={() => setFlipped((f) => !f)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); } }}>
        <div className="lp-in">
          <section className="lp-face lp-front" aria-hidden={flipped}>
            {band}
            <div className="lp-front-body">
              <div className="lp-big" lang="th">{card.thai}</div>
              <div className="lp-rom">{card.romanization}</div>
              <button type="button" className={`lp-play${playing === 'word' ? ' on' : ''}`} aria-label={`Play ${card.thai}`} onClick={(e) => { e.stopPropagation(); play('word', card.thai); }}><PlayIcon /></button>
            </div>
          </section>
          <section className="lp-face lp-back" aria-hidden={!flipped}>
            {band}
            <div className="lp-back-body">
              <div className="lp-top">
                {s && <button type="button" className={`lp-play sm${playing === 'sentence' ? ' on' : ''}`} aria-label="Play the sentence" onClick={(e) => { e.stopPropagation(); play('sentence', s.thai); }}><PlayIcon /></button>}
                <div className="lp-word">
                  <span lang="th">{card.thai}</span>
                  <b>{clean(card.english)}</b>
                </div>
              </div>
              {s && (
                <>
                  <div className="lp-boxes" lang="th">
                    {(s.words || [{ th: s.thai, rom: s.romanization }]).map((w, k) => (
                      <button key={k} type="button" className={`lp-box${w.th === card.thai ? ' target' : ''}${playing === `b${k}` ? ' on' : ''}`}
                        title={w.en || ''} aria-label={`Play ${w.th}${w.en ? `, ${w.en}` : ''}`}
                        onClick={(e) => { e.stopPropagation(); play(`b${k}`, w.th); }}>
                        <span className="th">{w.th}</span>
                        {w.rom && <small>{w.rom}</small>}
                      </button>
                    ))}
                  </div>
                  <p className="lp-en">{s.english}</p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
      <p className="lp-stage-note">{flipped ? 'Tap a word to hear it.' : 'A real card from the course. Tap it to flip.'}</p>
    </div>
  );
}

// Counts the hero sign's number up from 0 once, so the meter idea lands at a glance.
function useCountUp(target, ms = 1600) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return; }
    let raf; const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); setN(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

const Tick = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;

export default function Landing({ wordCount, demo, curve }) {
  const [persona, setPersona] = useState('live');
  const { user } = useUser();
  useEffect(() => {
    try { const p = localStorage.getItem(PERSONA_KEY); if (p && PERSONAS[p]) setPersona(p); } catch {}
  }, []);
  const choose = (p) => { setPersona(p); try { localStorage.setItem(PERSONA_KEY, p); } catch {} };
  const P = PERSONAS[persona];
  const count = wordCount.toLocaleString('en');
  const cta = user
    ? <a className="lp-btn" href="/today">Continue to Today</a>
    : <a className="lp-btn" href="/today">Start learning free</a>;
  const curvePts = Object.entries(curve).map(([n, pct]) => ({ n: Number(n), pct }));
  const maxPct = Math.max(...curvePts.map((p) => p.pct), 1);
  const goal = curvePts.find((p) => p.n >= 500) || curvePts[curvePts.length - 1] || { n: 500, pct: 50 };
  const meter = useCountUp(goal.pct);

  return (
    <main className="lp">
      <section className="lp-hero">
        <div className="lp-pitch">
          <div className="lp-brand">
            <SoiSign width={300} number={meter} title={`Soi Talk street sign showing ${meter}`} />
            <p className="lp-tag">Thai for your street.</p>
            <p className="lp-meter-note">The number on your sign is your street meter: the share of everyday Thai you understand. Learn {goal.n.toLocaleString('en')} words and it reads {goal.pct}.</p>
          </div>
          <p className="lp-who-label" id="who-label">I'm learning Thai because</p>
          <div className="lp-who" role="group" aria-labelledby="who-label">
            {Object.entries(PERSONAS).map(([id, p]) => (
              <button key={id} type="button" aria-pressed={persona === id} onClick={() => choose(id)}>{p.chip}</button>
            ))}
          </div>
          <h1>{P.h1}</h1>
          <p className="lp-lede">{P.lede}</p>
          <div className="lp-cta">
            {cta}
            {!user && <span>No signup needed. Save your progress later with Google or email.</span>}
          </div>
        </div>
        <DemoCard card={demo[persona]} />
      </section>

      <section className="lp-sec">
        <p className="lp-eyebrow">How it works</p>
        <h2>The words you need, in the order you need them</h2>
        <div className="lp-steps">
          <div className="lp-step" style={{ '--sc': '#F08A1C' }}>
            <span className="lp-n">1</span>
            <h3>Survival words first</h3>
            <p>{count} words ordered by how useful they are in daily life. Greetings, food and getting around come first. News and formal Thai wait until the end.</p>
          </div>
          <div className="lp-step" style={{ '--sc': '#2B86E8' }}>
            <span className="lp-n">2</span>
            <h3>A few minutes a day</h3>
            <p>Each day you get the cards that are due plus a few new ones. Help fades as you learn: first the English blurs, then the romanization.</p>
          </div>
          <div className="lp-step" style={{ '--sc': '#8B5CF6' }}>
            <span className="lp-n">3</span>
            <h3>Every sentence makes sense</h3>
            <p>Each card's example sentence only uses words you've already met, so you can always work it out.</p>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-split">
        <div>
          <p className="lp-eyebrow">Progress you can feel</p>
          <h2>See how much everyday Thai you already understand</h2>
          <p className="lp-sub">Every word in the course is ranked by how often Thai people use it, so each word you learn moves a real number: the share of everyday Thai you can follow.</p>
          <ul className="lp-ticks">
            <li><i><Tick /></i><span><b>Daily review.</b> The cards you're about to forget, at the right time.</span></li>
            <li><i><Tick /></i><span><b>Streaks in Thailand's colours of the day.</b> Yellow Monday, pink Tuesday and so on.</span></li>
            <li><i><Tick /></i><span><b>On every device.</b> Sign in once and pick up on your phone or laptop.</span></li>
          </ul>
        </div>
        <div className="lp-panel">
          <p className="lp-panel-title">Everyday Thai you understand after…</p>
          <div className="lp-curve">
            {curvePts.map(({ n, pct }) => (
              <div key={n} className="lp-curve-row">
                <span className="lp-curve-n">{n.toLocaleString('en')} words</span>
                <span className="lp-curve-bar"><i style={{ width: `${(pct / maxPct) * 100}%` }} /></span>
                <b>{pct}%</b>
              </div>
            ))}
          </div>
          <p className="lp-fine">Estimates from each word's frequency ranking. The first few hundred words do most of the work.</p>
        </div>
      </section>

      <section className="lp-sec">
        <p className="lp-eyebrow">Coming soon</p>
        <h2>Missions: small wins in real life</h2>
        <p className="lp-sub">Finish a word pack, then try it for real and tick it off.</p>
        <div className="lp-missions">
          {MISSIONS[persona].map(([where, th, text]) => (
            <div key={where} className="lp-mission">
              <span className="lp-where">{where}</span>
              <span className="lp-mth" lang="th">{th}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-next">
          <div>
            <p className="lp-eyebrow yellow">Coming next</p>
            <h2>Practise the conversation before you have it</h2>
            <p className="lp-sub light">Role-play a 7-Eleven checkout, a taxi ride or a market stall, using only the words you've learned so far.</p>
          </div>
          <div className="lp-chat" aria-label="Example role-play at 7-Eleven">
            <div className="lp-msg them"><small>Cashier</small><span lang="th">รับถุงไหมคะ</span><em>Do you want a bag?</em></div>
            <div className="lp-msg me"><small>You</small><span lang="th">ไม่เอาถุง ขอบคุณ</span><em>No bag, thanks.</em></div>
          </div>
        </div>
      </section>

      <section className="lp-close">
        <span className="lp-big-th" lang="th">เริ่มกันเลย</span>
        <h2>Let's get started</h2>
        {cta}
      </section>

      <footer className="lp-foot">
        <span>Thai Study Companion · made in Bangkok</span>
        <span><a href="/vocabulary">All words</a> · <a href="/privacy">Privacy</a></span>
      </footer>
    </main>
  );
}
