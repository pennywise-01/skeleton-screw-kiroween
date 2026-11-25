'use client';
import { useEffect, useState } from 'react';

const PHRASES = [
  'Spec before code.',
  'Powered by Kiro CLI.',
  'Two apps. One skeleton.',
];

export function Typewriter() {
  const [text, setText] = useState('');
  const [phrase, setPhrase] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(PHRASES[0]);
      return;
    }
    const full = PHRASES[phrase];
    let timer: ReturnType<typeof setTimeout>;

    if (!deleting && text.length < full.length) {
      timer = setTimeout(() => setText(full.slice(0, text.length + 1)), 55);
    } else if (!deleting && text.length === full.length) {
      timer = setTimeout(() => setDeleting(true), 2200);
    } else if (deleting && text.length > 0) {
      timer = setTimeout(() => setText(full.slice(0, text.length - 1)), 26);
    } else {
      setDeleting(false);
      setPhrase((phrase + 1) % PHRASES.length);
    }
    return () => clearTimeout(timer);
  }, [text, deleting, phrase]);

  return (
    <p className="h-7 mb-8 text-ectoplasm font-mono text-lg" aria-hidden="true">
      {text}
      <span className="animate-pulse">▌</span>
    </p>
  );
}
