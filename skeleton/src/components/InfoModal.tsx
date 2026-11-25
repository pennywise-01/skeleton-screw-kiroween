'use client';
import { useEffect, useRef, ReactNode } from 'react';

interface InfoModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
}

const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function InfoModal({ title, open, onClose, children, closeLabel = 'Enter if you dare 🎃' }: InfoModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      // Focus trap: cycle Tab / Shift+Tab inside the dialog
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => !el.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (!active || active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!active || active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="info-modal-backdrop" onClick={onClose}>
      <style>{`
        .info-modal-backdrop { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; background:rgba(13,2,23,0.82); backdrop-filter:blur(4px); padding:16px; }
        .info-modal { max-width:540px; width:100%; background:rgba(26,11,46,0.97); border:1px solid rgba(139,92,246,0.65); border-radius:1rem; box-shadow:0 0 40px rgba(139,92,246,0.4); padding:28px; animation: info-modal-in .25s ease-out; }
        @keyframes info-modal-in { from { transform: translateY(12px) scale(.97); opacity:0; } to { transform:none; opacity:1; } }
        .info-modal h2 { margin:0 0 12px; }
        .info-modal ol { list-style:decimal; margin:12px 0 12px 1.4rem; display:grid; gap:.5rem; }
        .info-modal p { margin:0 0 8px; line-height:1.6; }
        .info-modal-btn { margin-top:18px; width:100%; padding:10px 24px; border-radius:.5rem; font-weight:600; color:#fff; cursor:pointer; background:linear-gradient(180deg,#9333ea,#6b21a8); border:1px solid rgba(139,92,246,0.6); box-shadow:0 0 14px rgba(139,92,246,0.4); transition:all .2s; }
        .info-modal-btn:hover { box-shadow:0 0 22px rgba(139,92,246,0.7); transform:translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { .info-modal { animation:none; } .info-modal-btn { transition:none; } }
      `}</style>
      <div
        ref={dialogRef}
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl glow-pumpkin">{title}</h2>
        <div className="text-sm">{children}</div>
        <button className="info-modal-btn" onClick={onClose} autoFocus>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
