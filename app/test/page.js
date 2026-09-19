'use client';
import { useState } from 'react';

function Dot({ status }) {
  const color = status === 'ok' ? '#16a34a' : status === 'error' ? '#dc2626' : status === 'loading' ? '#f59e0b' : '#9ca3af';
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8 }} />;
}

export default function TestPage() {
  const [supabase, setSupabase] = useState({ status: 'idle', message: 'not tested yet' });
  const [stripe, setStripe] = useState({ status: 'idle', message: 'not tested yet' });
  const [elevenlabs, setElevenlabs] = useState({ status: 'idle', message: 'not tested yet' });
  const [audioUrl, setAudioUrl] = useState(null);

  async function testSupabase() {
    setSupabase({ status: 'loading', message: 'Checking...' });
    try {
      const res = await fetch('/api/test-supabase');
      const data = await res.json();
      setSupabase({ status: data.ok ? 'ok' : 'error', message: data.ok ? data.message : data.error });
    } catch (e) {
      setSupabase({ status: 'error', message: e.message });
    }
  }

  async function testStripe() {
    setStripe({ status: 'loading', message: 'Checking...' });
    try {
      const res = await fetch('/api/test-stripe');
      const data = await res.json();
      setStripe({ status: data.ok ? 'ok' : 'error', message: data.ok ? data.message : data.error });
    } catch (e) {
      setStripe({ status: 'error', message: e.message });
    }
  }

  async function testElevenLabs() {
    setElevenlabs({ status: 'loading', message: 'Generating Thai audio clip...' });
    setAudioUrl(null);
    try {
      const res = await fetch('/api/test-elevenlabs');
      if (!res.ok) {
        let errMsg = res.statusText;
        try { const data = await res.json(); errMsg = data.error || errMsg; } catch {}
        setElevenlabs({ status: 'error', message: errMsg });
        return;
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
      setElevenlabs({ status: 'ok', message: 'Audio generated — press play below.' });
    } catch (e) {
      setElevenlabs({ status: 'error', message: e.message });
    }
  }

  const box = { border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 };
  const btn = { padding: '8px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', marginBottom: 8 };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '40px', maxWidth: '640px', margin: '0 auto' }}>
      <h1>Connection Test</h1>
      <p style={{ color: '#6b7280' }}>Internal diagnostic page &mdash; not part of the real app, just checks each service is wired up correctly.</p>

      <div style={box}>
        <button style={btn} onClick={testSupabase}>Test Supabase</button>
        <div><Dot status={supabase.status} /><strong>Supabase:</strong> {supabase.message}</div>
      </div>

      <div style={box}>
        <button style={btn} onClick={testStripe}>Test Stripe</button>
        <div><Dot status={stripe.status} /><strong>Stripe:</strong> {stripe.message}</div>
      </div>

      <div style={box}>
        <button style={btn} onClick={testElevenLabs}>Test ElevenLabs (generates real Thai audio)</button>
        <div><Dot status={elevenlabs.status} /><strong>ElevenLabs:</strong> {elevenlabs.message}</div>
        {audioUrl && <audio controls src={audioUrl} style={{ marginTop: 8, width: '100%' }} />}
      </div>
    </main>
  );
}
