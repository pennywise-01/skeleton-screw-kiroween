'use client';
import { useState } from 'react';
import { FileUpload, CodePreview, useAgent, SpookyLoader, InfoModal } from 'skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ESLint reports absolute paths; uploads carry their own names — match both
function sameFile(findingPath: string, uploadName: string): boolean {
  if (findingPath === uploadName) return true;
  const norm = findingPath.replace(/\\/g, '/');
  const name = uploadName.replace(/\\/g, '/').replace(/^\/+/, '');
  return norm.endsWith(name) || norm.split('/').pop() === name.split('/').pop();
}

function langOf(path: string): string {
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.vue')) return 'vue';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  return 'tsx';
}

interface Finding {
  file: string;
  line: number;
  col: number;
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
}

const EXAMPLE_FILES = [
  { 
    name: 'App.tsx', 
    content: `import React from 'react';

function App() {
  const handleClick = () => alert('clicked');
  
  return (
    <div>
      <img src="logo.png" />
      <button onClick={handleClick}>Click</button>
      <a href="#">Link</a>
    </div>
  );
}

export default App;`
  },
];

export default function A11yAuditor() {
  const agent = useAgent();
  const [files, setFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fixed, setFixed] = useState<Array<{ path: string; before: string; after: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanned, setScanned] = useState(false);
  const [initialGhosts, setInitialGhosts] = useState(0);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [fixingFile, setFixingFile] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('skeleton-info-a11y') !== 'dismissed';
  });
  const closeInfo = () => {
    sessionStorage.setItem('skeleton-info-a11y', 'dismissed');
    setShowInfo(false);
  };

  const loadExample = () => {
    setFiles(EXAMPLE_FILES);
    setFindings([]);
    setFixed([]);
  };

  const handleReset = () => {
    setFiles([]);
    setFindings([]);
    setFixed([]);
    setScanned(false);
    setInitialGhosts(0);
    setScanError('');
  };

  const handleScan = async (overrideFiles?: Array<{ name: string; content: string }>) => {
    const toScan = overrideFiles ?? files;
    setLoading(true);
    setScanError('');
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: toScan }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      const found = Array.isArray(data.findings) ? data.findings : [];
      setFindings(found);
      setInitialGhosts((prev) => (overrideFiles ? prev : found.length));
      setScanned(true);
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fixOneFile = async (
    file: string,
    currentFiles: Array<{ name: string; content: string }>,
    currentFindings: Finding[],
  ): Promise<Array<{ name: string; content: string }>> => {
    const fileContent = currentFiles.find((f) => sameFile(file, f.name))?.content;
    const fileFindings = currentFindings.filter((f) => f.file === file);

    const result = await agent.generate({
      task: `Fix these accessibility issues. Make MINIMAL changes. Do NOT alter any logic or styling. Return ONLY the fixed code.`,
      context: `File: ${file}\n\n${fileContent}\n\nIssues to fix:\n${fileFindings.map((f) => `- Line ${f.line}: ${f.ruleId} - ${f.message}`).join('\n')}`,
      outputSchema: 'code',
    });

    if (!('code' in result)) {
      throw new Error('Unexpected response shape');
    }
    if (!result.code.trim()) {
      throw new Error('AI returned an empty fix — try again');
    }

    setFixed((prev) => [...prev, { path: file, before: fileContent!, after: result.code }]);
    const nextFiles = currentFiles.map((f) => (sameFile(file, f.name) ? { ...f, content: result.code } : f));
    setFiles(nextFiles);
    setFindings((prev) => prev.filter((f) => f.file !== file));
    return nextFiles;
  };

  const handleFix = async (file: string) => {
    setFixingFile(file);
    setScanError('');
    try {
      await fixOneFile(file, files, findings);
    } catch (err) {
      setScanError(`Fix failed for ${file}: ${(err as Error).message}`);
    } finally {
      setFixingFile(null);
    }
  };

  const handleFixAll = async () => {
    setLoading(true);
    setScanError('');
    const failed: string[] = [];
    try {
      const uniqueFiles = [...new Set(findings.map((f) => f.file))];
      let currentFiles = files;
      for (const fileName of uniqueFiles) {
        try {
          currentFiles = await fixOneFile(fileName, currentFiles, findings);
        } catch (err) {
          failed.push(`${fileName}: ${(err as Error).message}`);
        }
      }
      // Re-scan with the fixed content to prove the ghosts are gone
      await handleScan(currentFiles);
      if (failed.length) {
        setScanError(`Some files could not be fixed — ${failed.join(' | ')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFixed = async () => {
    const zip = new JSZip();
    fixed.forEach((f) => zip.file(f.path, f.after));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'fixed-files.zip');
  };

  if (!agent.ready) {
    return <div className="max-w-6xl mx-auto p-8 text-purple-300">Summoning the spirits...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <InfoModal title="🕸️ A11y Auditor" open={showInfo} onClose={closeInfo}>
        <p className="text-purple-200">Hunt accessibility ghosts in any codebase, then exorcise them with AI.</p>
        <ol className="text-purple-200">
          <li>Drop files or a whole .zip — it extracts right in your browser.</li>
          <li>Scan. Kiro AI reads every file and reports real WCAG violations — any language, any framework.</li>
          <li>Exorcise one ghost or Fix All — watch the count drop to zero.</li>
        </ol>
        <p className="text-purple-400 text-xs">
          Files are scanned locally. They are sent to the AI provider in the header only when you fix, and nothing is stored.
        </p>
      </InfoModal>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-5xl glow-witch">🕸️ A11y Auditor</h1>
        <button
          onClick={() => setShowInfo(true)}
          aria-label="How it works"
          title="How it works"
          className="text-xs px-3 py-1 rounded-full border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition"
        >
          ℹ️ How it works
        </button>
      </div>
      <p className="text-purple-400 mb-6 italic">Hunt the accessibility ghosts haunting your code</p>

      {scanError && (
        <div className="mb-6 p-4 border-l-4 border-blood bg-red-950 text-red-300 rounded">💀 {scanError}</div>
      )}

      {files.length === 0 && (
        <div>
          <FileUpload
            accept={{ 'text/*': ['.jsx', '.tsx', '.js', '.ts', '.html', '.htm', '.vue', '.svelte', '.erb', '.ejs', '.py', '.rb', '.php', '.md', '.txt'], 'application/zip': ['.zip'] }}
            maxSize={10 * 1024 * 1024}
            onFiles={setFiles}
          />
          <button 
            onClick={loadExample} 
            className="mt-4 px-6 py-2 bg-purple-800 text-purple-200 border border-purple-600 rounded hover:bg-purple-700"
          >
            🎃 Load Haunted Example
          </button>
        </div>
      )}

      {initialGhosts > 0 && (
        <div className="card-haunt p-4 mb-6 text-center">
          <div className="text-2xl">
            <span className="glow-pumpkin">{initialGhosts} 👻</span>
            <span className="text-purple-400 mx-3">→</span>
            <span className={findings.length ? 'glow-witch' : 'glow-ecto'}>
              {findings.length} remaining
            </span>
          </div>
          {findings.length === 0 && (
            <div className="text-ectoplasm mt-1 font-bold">🏆 All ghosts banished!</div>
          )}
        </div>
      )}

      {files.length > 0 && findings.length === 0 && fixed.length === 0 && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-purple-300">📜 {files.length} file(s) loaded</span>
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1 rounded-full border border-purple-600 text-purple-300 hover:border-pumpkin hover:text-pumpkin transition"
            >
              🔄 Upload Different Files
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {files.map((f) => (
              <span
                key={f.name}
                className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full border border-purple-600 bg-[rgba(26,11,46,0.75)] text-purple-200"
              >
                <button
                  onClick={() => setPreviewFile(previewFile === f.name ? null : f.name)}
                  aria-expanded={previewFile === f.name}
                  className="hover:text-ectoplasm transition"
                >
                  {f.name} · {f.content.split('\n').length} lines
                </button>
                <button
                  onClick={() => setFiles(files.filter((x) => x.name !== f.name))}
                  aria-label={`Remove ${f.name}`}
                  className="text-purple-500 hover:text-red-400 transition"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          {previewFile && (() => {
            const f = files.find((x) => x.name === previewFile);
            return f ? (
              <div className="max-h-64 overflow-auto mb-4 card-haunt p-2">
                <CodePreview after={f.content} language={f.name.endsWith('.html') || f.name.endsWith('.htm') ? 'html' : 'tsx'} />
              </div>
            ) : null;
          })()}
          <button 
            onClick={() => handleScan()} 
            disabled={loading} 
            className="btn-haunt px-6 py-2 text-white rounded"
          >
            {loading ? '🔮 Summoning ghosts...' : '🕵️ Scan for Ghosts'}
          </button>
          {loading && <SpookyLoader estimatedSeconds={10} phrases={['Summoning ghosts', 'Haunting your files', 'Counting cobwebs']} />}
          {scanned && findings.length === 0 && !scanError && !loading && (
            <div className="mt-4 text-ectoplasm">✨ No ghosts — this code is clean!</div>
          )}
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl glow-pumpkin">👻 Ghosts Found ({findings.length})</h2>
            <button
              onClick={handleFixAll}
              disabled={loading}
              className="btn-pumpkin px-5 py-2 text-white rounded font-semibold"
            >
              🧹 Fix All
            </button>
          </div>
          {loading && <SpookyLoader estimatedSeconds={45} phrases={['Brewing the exorcism', 'Banishing ghosts', 'Scrubbing the cobwebs']} />}
          {Object.entries(
            findings.reduce<Record<string, Finding[]>>((acc, f) => {
              (acc[f.file] ??= []).push(f);
              return acc;
            }, {})
          ).map(([file, fileFindings]) => (
            <div key={file} className="card-haunt p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-sm text-pumpkin">
                  {file} — {fileFindings.length} ghost{fileFindings.length === 1 ? '' : 's'}
                </h3>
                <button
                  onClick={() => handleFix(file)}
                  disabled={loading || fixingFile !== null}
                  className="text-xs px-3 py-1 rounded border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition disabled:opacity-50"
                >
                  ✨ Exorcise File
                </button>
              </div>
              {fixingFile === file && (
                <SpookyLoader estimatedSeconds={45} phrases={['Brewing the exorcism', 'Banishing ghosts']} />
              )}
              {fileFindings.map((f, i) => (
                <div
                  key={i}
                  className={`border-l-4 ${f.severity === 'error' ? 'border-l-red-500' : 'border-l-yellow-500'} pl-3 mb-3`}
                >
                  <div className="font-mono text-xs text-purple-400">{f.line}:{f.col}</div>
                  <div className={`font-bold ${f.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {f.severity === 'error' ? '💀' : '⚠️'} {f.ruleId}
                  </div>
                  <div className="text-purple-200 text-sm">{f.message}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {fixed.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl glow-ecto">🧹 Exorcised Files</h2>
            <button
              onClick={() => handleScan()}
              disabled={loading}
              className="text-xs px-4 py-2 rounded border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition disabled:opacity-50"
            >
              🔍 Re-scan Patched Files
            </button>
          </div>
          <div className="mb-4 text-sm text-purple-300">⚡ Banished with {agent.provider}</div>
          {fixed.map((f) => (
            <div key={f.path} className="mb-8 card-haunt p-4">
              <h3 className="font-mono text-sm mb-2 font-bold text-pumpkin">{f.path}</h3>
              <div className="max-h-96 overflow-auto">
                <CodePreview before={f.before} after={f.after} language={langOf(f.path)} showDiff />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDownloadFixed} 
              className="btn-pumpkin px-6 py-2 text-white rounded font-semibold"
            >
              🧟 Download Exorcised Files
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-purple-800 text-purple-200 border border-purple-600 rounded hover:bg-purple-700"
            >
              🔄 Audit New Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
