'use client';
import { useEffect, useState } from 'react';

const DEFAULT_PHRASES = [
  'Summoning spirits',
  'Consulting the grimoire',
  'Raising the dead code',
  'Brewing the potion',
];

interface SpookyLoaderProps {
  /** Rotating status phrases. Falls back to a spooky default set. */
  phrases?: string[];
  /** Milliseconds between phrase rotations. */
  intervalMs?: number;
  /** Expected duration in seconds. Shows a progress bar, elapsed time and the estimate. */
  estimatedSeconds?: number;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export function SpookyLoader({ phrases, intervalMs = 2200, estimatedSeconds }: SpookyLoaderProps) {
  const list = phrases?.length ? phrases : DEFAULT_PHRASES;
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % list.length), intervalMs);
    return () => clearInterval(id);
  }, [list.length, intervalMs]);

  useEffect(() => {
    if (!estimatedSeconds) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(id);
  }, [estimatedSeconds]);

  // Eases toward ~95% asymptotically: fast start, never falsely completes
  const pct = estimatedSeconds
    ? Math.min(95, 95 * (1 - Math.exp((-2.2 * elapsed) / estimatedSeconds)))
    : 0;

  return (
    <div className="spooky-loader" role="status" aria-live="polite">
      <style>{`
        .spooky-loader { display:flex; flex-direction:column; align-items:center; gap:14px; padding:36px 0; }
        .spooky-stage { position:relative; width:220px; height:90px; display:flex; align-items:center; justify-content:center; }
        .spooky-ghost { font-size:56px; line-height:1; animation: spooky-bob 2s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(139,92,246,0.75)); }
        .spooky-bat { position:absolute; top:8px; font-size:20px; opacity:.75; animation: spooky-flutter 5s ease-in-out infinite; }
        .spooky-bat.b1 { left:0; }
        .spooky-bat.b2 { right:0; animation-delay:2.5s; }
        @keyframes spooky-bob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-16px) rotate(3deg); } }
        @keyframes spooky-flutter { 0%,100% { transform: translate(0,0) scaleX(1); } 25% { transform: translate(10px,-12px) scaleX(-1); } 50% { transform: translate(0,-4px) scaleX(1); } 75% { transform: translate(-10px,-14px) scaleX(-1); } }
        .spooky-text { color:#c9bfe0; font-size:15px; animation: spooky-flicker 2.4s ease-in-out infinite; }
        @keyframes spooky-flicker { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        .spooky-dots::after { content:''; animation: spooky-dots 1.2s steps(4) infinite; }
        @keyframes spooky-dots { 0%{content:'';} 25%{content:'.';} 50%{content:'..';} 75%{content:'...';} }
        .spooky-bar-wrap { width:320px; max-width:80vw; }
        .spooky-bar { height:10px; border-radius:9999px; background:rgba(139,92,246,0.18); border:1px solid rgba(139,92,246,0.45); overflow:hidden; }
        .spooky-bar-fill { height:100%; border-radius:9999px; background:linear-gradient(90deg,#8b5cf6,#ff7518,#39ff14); background-size:200% 100%; box-shadow:0 0 12px rgba(255,117,24,0.5); transition:width .3s ease; animation: spooky-shimmer 2s linear infinite; }
        @keyframes spooky-shimmer { 0% { background-position:0% 0; } 100% { background-position:200% 0; } }
        .spooky-meta { display:flex; justify-content:space-between; margin-top:6px; font-size:12px; color:#8f86a8; font-variant-numeric:tabular-nums; }
        @media (prefers-reduced-motion: reduce) {
          .spooky-ghost, .spooky-bat, .spooky-text, .spooky-dots::after, .spooky-bar-fill { animation: none !important; }
        }
      `}</style>
      <div className="spooky-stage">
        <span className="spooky-bat b1" aria-hidden>🦇</span>
        <span className="spooky-ghost" aria-hidden>👻</span>
        <span className="spooky-bat b2" aria-hidden>🦇</span>
      </div>
      <div className="spooky-text spooky-dots">{list[i]}</div>
      {estimatedSeconds ? (
        <div className="spooky-bar-wrap">
          <div
            className="spooky-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label="Estimated progress"
          >
            <div className="spooky-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="spooky-meta">
            <span>{fmt(elapsed)} elapsed</span>
            <span>usually ~{fmt(estimatedSeconds)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
