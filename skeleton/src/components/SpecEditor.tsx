'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SpecEditorProps {
  initialValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

type Mode = 'edit' | 'split' | 'preview';

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'edit', label: '✏️ Edit' },
  { id: 'split', label: '👁️ Split' },
  { id: 'preview', label: '📖 Preview' },
];

export function SpecEditor({ initialValue = '', onChange, disabled = false }: SpecEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [mode, setMode] = useState<Mode>('edit');

  // Stay in sync when the parent regenerates the spec
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const editor = (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => {
        setValue(e.target.value);
        onChange(e.target.value);
      }}
      aria-label="Spec editor"
      className="flex-1 min-h-[16rem] font-mono text-sm border border-[#8b5cf6] rounded p-3 bg-[#12061f] text-[#e9e4f5] focus:border-[#39ff14] focus:outline-none disabled:opacity-50"
    />
  );

  const previewPane = (
    <div className="md-preview max-w-none p-4 border border-[#8b5cf6] rounded bg-[rgba(13,2,23,0.8)] min-h-[16rem] max-h-[32rem] overflow-auto text-[#e9e4f5]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-3 mb-3" role="tablist" aria-label="Editor view">
        {MODES.map((m) => (
          <button
            key={m.id}
            id={`spec-tab-${m.id}`}
            role="tab"
            aria-selected={mode === m.id}
            aria-controls="spec-tabpanel"
            disabled={disabled}
            onClick={() => setMode(m.id)}
            className={`px-5 py-2 rounded-md border transition disabled:opacity-50 ${
              mode === m.id
                ? 'font-bold border-[#39ff14] bg-[#1a0b2e] text-[#e9e4f5] shadow-[0_0_10px_rgba(57,255,20,0.3)]'
                : 'border-[#8b5cf6] text-purple-300 hover:border-[#39ff14]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div
        id="spec-tabpanel"
        role="tabpanel"
        aria-labelledby={`spec-tab-${mode}`}
        className={mode === 'split' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'flex flex-col'}
      >
        {mode === 'edit' && editor}
        {mode === 'preview' && previewPane}
        {mode === 'split' && (
          <>
            {editor}
            {previewPane}
          </>
        )}
      </div>
    </div>
  );
}
