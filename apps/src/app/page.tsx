import Link from 'next/link';
import { Typewriter } from '../components/Typewriter';

export default function Home() {
  return (
    <div className="relative max-w-4xl mx-auto p-8 text-center min-h-[calc(100vh-3.5rem)] flex flex-col justify-center">
      {/* Atmosphere: drifting fog + flying bats */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="fog fog-a" />
        <div className="fog fog-b" />
        <svg className="bat-fly" viewBox="0 0 24 12" width="34" height="17">
          <path d="M0,7 Q6,0 12,5 Q18,0 24,7 Q18,5 12,11 Q6,5 0,7 Z" fill="#1a0b2e" />
        </svg>
        <svg className="bat-fly bat-b" viewBox="0 0 24 12" width="26" height="13">
          <path d="M0,7 Q6,0 12,5 Q18,0 24,7 Q18,5 12,11 Q6,5 0,7 Z" fill="#1a0b2e" />
        </svg>
      </div>

      <div className="relative z-10">
        <h1 className="text-7xl mb-4 glow-pumpkin">🦴 Skeleton</h1>
        <p className="text-xl text-purple-300 mb-2">One component library. Two haunted apps.</p>
        <span className="sr-only">Spec before code. Powered by Kiro CLI. Two apps, one skeleton.</span>
        <Typewriter />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <Link href="/lambda" className="card-haunt card-glow-ecto p-8 block transition-all">
            <h2 className="text-3xl mb-2 glow-ecto">⚡ Lambda</h2>
            <p className="text-purple-300">Raise serverless functions from the dead</p>
            <p className="text-xs text-purple-400 mt-3">Prompt → spec → code → deploy</p>
          </Link>

          <Link href="/a11y" className="card-haunt card-glow-witch p-8 block transition-all">
            <h2 className="text-3xl mb-2 glow-witch">🕸️ A11y</h2>
            <p className="text-purple-300">Exorcise accessibility ghosts from your code</p>
            <p className="text-xs text-purple-400 mt-3">Scan → fix → download</p>
          </Link>
        </div>

        <div>
          <h2 className="text-2xl glow-witch mb-2">🦴 Shared Anatomy</h2>
          <p className="text-sm text-purple-300 mb-4">
            Six primitives from one skeleton — every app borrows its bones. ⚡ Lambda · 🕸️ A11y
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'AgentProvider', apps: '⚡🕸️', cls: 'border-purple-500' },
              { name: 'SpecEditor', apps: '⚡', cls: 'border-ectoplasm' },
              { name: 'CodePreview', apps: '⚡🕸️', cls: 'border-purple-500' },
              { name: 'FileUpload', apps: '🕸️', cls: 'border-witch' },
              { name: 'SpookyLoader', apps: '⚡🕸️', cls: 'border-purple-500' },
              { name: 'InfoModal', apps: '⚡🕸️', cls: 'border-purple-500' },
            ].map((c) => (
              <span
                key={c.name}
                className={`group font-mono text-xs px-3 py-1.5 rounded-full border ${c.cls} bg-[rgba(26,11,46,0.75)] text-purple-200 shadow-[0_0_10px_rgba(139,92,246,0.2)] transition hover:shadow-[0_0_16px_rgba(255,117,24,0.4)]`}
              >
                {c.name}
                <span className="ml-2 opacity-40 group-hover:opacity-100 transition">{c.apps}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

