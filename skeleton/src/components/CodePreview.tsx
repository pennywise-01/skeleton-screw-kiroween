'use client';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import * as Diff from 'diff';

interface CodePreviewProps {
  before?: string;
  after: string;
  language: string;
  showDiff?: boolean;
}

type View = 'diff' | 'final' | 'before';

export function CodePreview({ before, after, language, showDiff }: CodePreviewProps) {
  const hasDiff = Boolean(showDiff && before);
  const [view, setView] = useState<View>(hasDiff ? 'diff' : 'final');
  const [copied, setCopied] = useState(false);

  // Unified diff minus the noisy "Index:" / "===" preamble
  const patch = hasDiff
    ? Diff.createPatch('file', before!, after)
        .split('\n')
        .filter((l) => !l.startsWith('Index:') && !l.startsWith('==='))
        .join('\n')
    : '';

  const content = view === 'diff' ? patch : view === 'before' ? before! : after;
  const lang = view === 'diff' ? 'diff' : language;

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {hasDiff ? (
          <div className="flex gap-1" role="tablist" aria-label="Code view">
            {(['diff', 'final', 'before'] as View[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`text-xs px-3 py-1 rounded border transition ${
                  view === v
                    ? 'border-[#39ff14] text-[#39ff14] font-bold'
                    : 'border-[#8b5cf6] text-purple-300 hover:border-[#39ff14]'
                }`}
              >
                {v === 'diff' ? '🔀 Diff' : v === 'final' ? '✨ Final' : '📄 Before'}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={copy}
          className="text-xs px-3 py-1 rounded border border-[#8b5cf6] text-purple-300 hover:border-[#39ff14] hover:text-[#39ff14] transition"
        >
          {copied ? '✅ Copied' : '📋 Copy'}
        </button>
      </div>
      <SyntaxHighlighter language={lang} style={vscDarkPlus} showLineNumbers>
        {content}
      </SyntaxHighlighter>
    </div>
  );
}
