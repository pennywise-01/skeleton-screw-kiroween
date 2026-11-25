'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAgent } from 'skeleton';

const NAV = [
  { href: '/lambda', label: '⚡ Lambda' },
  { href: '/a11y', label: '🕸️ A11y' },
];

export function AppHeader() {
  const { available, ready } = useAgent();
  const pathname = usePathname();

  const label = !ready
    ? 'Summoning...'
    : available.demo
      ? '🎭 Demo mode'
      : available.kiro
        ? '⚡ Powered by Kiro CLI'
        : '⚠️ kiro-cli not found';

  const pill = available.demo
    ? 'text-pumpkin border-pumpkin'
    : available.kiro
      ? 'text-ectoplasm border-ectoplasm'
      : 'text-red-400 border-red-500';

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-[rgba(13,2,23,0.78)] border-b border-[rgba(139,92,246,0.35)]">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-spooky text-2xl glow-pumpkin tracking-wide">
            🦴 Skeleton
          </Link>
          <nav className="flex gap-1" aria-label="Apps">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3 py-1 rounded text-sm transition ${
                    active
                      ? 'text-ectoplasm border-b-2 border-ectoplasm font-bold'
                      : 'text-purple-300 hover:text-purple-100'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${pill}`}>
          {label}
        </span>
      </div>
    </header>
  );
}
