'use client';
import { useState } from 'react';
import { useAgent, SpecEditor, CodePreview, SpookyLoader, InfoModal } from 'skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type GenFile = { path: string; content: string };

function langOf(path: string): string {
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  return 'javascript';
}

interface DeployCheck {
  ok: boolean;
  runtime: string;
  handler: string;
  note?: string;
}

function detectDeployability(files: GenFile[]): DeployCheck {
  const paths = files.map((f) => f.path);
  if (paths.some((p) => p.endsWith('.py'))) {
    return { ok: true, runtime: 'Python 3.12', handler: 'handler.lambda_handler' };
  }
  if (paths.some((p) => /\.(js|mjs|cjs)$/.test(p))) {
    return { ok: true, runtime: 'Node.js 20.x', handler: 'handler.handler' };
  }
  if (paths.some((p) => /\.tsx?$/.test(p))) {
    return { ok: false, runtime: 'TypeScript', handler: '', note: 'needs a build step to plain JavaScript first' };
  }
  const known: Record<string, string> = {
    go: 'Go', rb: 'Ruby', java: 'Java', cs: '.NET', php: 'PHP', rs: 'Rust',
  };
  for (const p of paths) {
    const ext = p.split('.').pop()?.toLowerCase() ?? '';
    if (known[ext]) return { ok: false, runtime: known[ext], handler: '' };
  }
  return { ok: false, runtime: 'This language', handler: '' };
}

export default function LambdaScaffolder() {
  const agent = useAgent();
  const [prompt, setPrompt] = useState('');
  const [spec, setSpec] = useState('');
  const [code, setCode] = useState<GenFile[]>([]);
  const [step, setStep] = useState<'prompt' | 'spec' | 'code'>('prompt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const estimate = (kiroSeconds: number) =>
    agent.available.demo ? 5 : kiroSeconds;

  const [showInfo, setShowInfo] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('skeleton-info-lambda') !== 'dismissed';
  });
  const closeInfo = () => {
    sessionStorage.setItem('skeleton-info-lambda', 'dismissed');
    setShowInfo(false);
  };

  const copyFile = async (path: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(path);
    setTimeout(() => setCopied(''), 1500);
  };

  const downloadFile = (f: GenFile) => {
    saveAs(new Blob([f.content], { type: 'text/plain;charset=utf-8' }), f.path.split('/').pop() ?? f.path);
  };

  const handleGenerateSpec = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await agent.generate({
        task: `Write a detailed spec for an AWS Lambda function that: ${prompt}. Return ONLY the spec as markdown.`,
        outputSchema: 'code',
      });
      if (!('code' in result)) throw new Error('Unexpected response shape');
      setSpec(result.code);
      setStep('spec');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await agent.generate({
        task: 'Implement this Lambda function spec. Use the programming language and runtime the spec asks for (e.g. Python -> handler.py + requirements.txt, Node.js -> handler.js + package.json). Include a test file for the handler (handler.test.js using node:test for Node.js, or test_handler.py using pytest for Python). Include a README.md.',
        context: spec,
        outputSchema: 'files',
      });
      if (!('files' in result)) throw new Error('Unexpected response shape');
      setCode(result.files);
      setExplanation(result.explanation ?? '');
      setStep('code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const [explanation, setExplanation] = useState('');

  const handleStartOver = () => {
    setPrompt('');
    setSpec('');
    setCode([]);
    setExplanation('');
    setError('');
    setStep('prompt');
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    code.forEach((f) => zip.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'lambda-function.zip');
  };

  if (!agent.ready) return <div className="p-8 text-purple-300">Summoning the spirits...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <InfoModal title="⚡ Lambda Scaffolder" open={showInfo} onClose={closeInfo}>
        <p className="text-purple-200">Turn one sentence into a specced, tested, ready-to-deploy Lambda function.</p>
        <ol className="text-purple-200">
          <li>Describe your function — name the language (Node.js or Python deploy smoothest).</li>
          <li>Review the spec and edit anything. Spec before code, always.</li>
          <li>Generate code, tests and README. Copy a file, download one, or grab the ZIP.</li>
        </ol>
        <p className="text-purple-400 text-xs">
          Your prompt goes to the AI provider shown in the header. Deploy happens in your own AWS account — we show the exact runtime and handler to pick.
        </p>
      </InfoModal>

      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-5xl glow-ecto">⚡ Lambda Scaffolder</h1>
        <button
          onClick={() => setShowInfo(true)}
          aria-label="How it works"
          title="How it works"
          className="text-xs px-3 py-1 rounded-full border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition"
        >
          ℹ️ How it works
        </button>
      </div>
      <p className="text-purple-400 mb-4 italic">Raise serverless functions from the grave</p>

      {(() => {
        const steps = ['Prompt', 'Spec', 'Code'] as const;
        const order = ['prompt', 'spec', 'code'] as const;
        const current = order.indexOf(step);
        const canVisit = (i: number) =>
          i === 0 || (i === 1 && Boolean(spec)) || (i === 2 && code.length > 0);
        return (
          <ol className="flex items-center gap-2 mb-8" aria-label="Progress">
            {steps.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <button
                  onClick={() => canVisit(i) && i !== current && setStep(order[i])}
                  disabled={!canVisit(i) || i === current}
                  aria-current={i === current ? 'step' : undefined}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm transition ${
                    i === current
                      ? 'border-ectoplasm text-ectoplasm shadow-[0_0_10px_rgba(57,255,20,0.35)]'
                      : canVisit(i)
                        ? 'border-pumpkin text-pumpkin hover:bg-[rgba(255,117,24,0.1)]'
                        : 'border-purple-800 text-purple-400'
                  }`}
                >
                  <span className="font-bold">{i + 1}</span> {label}
                </button>
                {i < steps.length - 1 && <span className="text-purple-700">→</span>}
              </li>
            ))}
          </ol>
        );
      })()}

      {error && (
        <div className="mb-4 p-4 border-l-4 border-blood bg-red-950 text-red-300 rounded">💀 {error}</div>
      )}

      {step === 'prompt' && (
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your Lambda function..."
            disabled={loading}
            className="input-haunt w-full h-32 p-4 rounded disabled:opacity-50"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: '🖼️ S3 Image Metadata Extractor (Node.js)', text: 'An S3 image metadata extractor in Node.js: trigger on S3 object-created events for new uploads, read image dimensions and EXIF data, and write the metadata as JSON to a DynamoDB table.' },
              { label: '💳 Webhook Signature Verifier (Python)', text: 'A webhook signature verifier in Python: receive HTTP POST webhooks, verify the HMAC-SHA256 signature against a secret, and forward valid events to an SQS queue; reject invalid ones with 401.' },
              { label: '🧹 Scheduled Log Sanitizer (Node.js)', text: 'A scheduled log sanitizer in Node.js: run daily via EventBridge, scan CloudWatch log exports in an S3 bucket, redact emails and credit card numbers, and write sanitized files to a separate bucket.' },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.text)}
                className="text-xs px-3 py-1.5 rounded-full border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition"
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerateSpec}
            disabled={loading || !prompt}
            className="btn-haunt mt-4 px-6 py-2 text-white rounded"
          >
            {loading ? '🔮 Consulting the grimoire...' : '📜 Generate Spec'}
          </button>
          {loading && <SpookyLoader estimatedSeconds={estimate(60)} phrases={['Consulting the grimoire', 'Summoning the spec', 'Reading the bones']} />}
        </div>
      )}

      {step === 'spec' && (
        <div>
          <h2 className="text-2xl mb-4 glow-pumpkin">Spec (edit as needed)</h2>
          <div className="card-haunt p-4">
            <SpecEditor initialValue={spec} onChange={setSpec} disabled={loading} />
          </div>
          <div className="mt-4 flex gap-4">
            <button onClick={() => setStep('prompt')} className="px-6 py-2 bg-purple-800 text-purple-200 border border-purple-600 rounded hover:bg-purple-700">
              ← Back
            </button>
            <button
              onClick={handleGenerateCode}
              disabled={loading}
              className="btn-haunt px-6 py-2 text-white rounded"
            >
              {loading ? '⚗️ Raising the dead code...' : '⚰️ Generate Code'}
            </button>
          </div>
          {loading && <SpookyLoader estimatedSeconds={estimate(300)} phrases={['Raising the dead code', 'Stitching the files together', 'Waking the Lambda']} />}
        </div>
      )}

      {step === 'code' && (
        <div>
          <h2 className="text-2xl mb-4 glow-pumpkin">Generated Code</h2>
          <div className="mb-4 text-sm text-purple-300">⚡ Risen with {agent.provider}</div>
          {explanation && (
            <div className="card-haunt p-4 mb-4 text-sm text-purple-200">
              <span className="text-pumpkin font-bold">🏗️ Architecture:</span> {explanation}
            </div>
          )}
          <div className="mt-2 mb-6 flex items-center gap-4 flex-wrap">
            <button onClick={handleDownloadZip} className="btn-pumpkin px-6 py-2 text-white rounded font-semibold">
              🧟 Download ZIP
            </button>
            <button
              onClick={() => setStep('spec')}
              className="px-6 py-2 bg-purple-800 text-purple-200 border border-purple-600 rounded hover:bg-purple-700"
            >
              ← Back to Spec
            </button>
            <button
              onClick={handleStartOver}
              className="px-6 py-2 bg-purple-800 text-purple-200 border border-purple-600 rounded hover:bg-purple-700"
            >
              🔄 Start Over
            </button>
          </div>
          {code.map((file) => (
            <div key={file.path} className="mb-4 card-haunt p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-sm text-pumpkin">{file.path}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyFile(file.path, file.content)}
                    className="text-xs px-3 py-1 rounded border border-purple-600 text-purple-300 hover:border-ectoplasm hover:text-ectoplasm transition"
                  >
                    {copied === file.path ? '✅ Copied' : '📋 Copy'}
                  </button>
                  <button
                    onClick={() => downloadFile(file)}
                    className="text-xs px-3 py-1 rounded border border-purple-600 text-purple-300 hover:border-pumpkin hover:text-pumpkin transition"
                  >
                    ⬇ Download
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-auto">
                <CodePreview after={file.content} language={langOf(file.path)} />
              </div>
            </div>
          ))}
          {(() => {
            const check = detectDeployability(code);
            return (
              <>
                {check.ok ? (
                  <div className="mt-4 p-3 border-l-4 border-ectoplasm bg-green-950 text-green-300 rounded text-sm">
                    ✅ AWS Lambda compatible ({check.runtime})
                  </div>
                ) : (
                  <div className="mt-4 p-3 border-l-4 border-pumpkin bg-orange-950 text-orange-300 rounded text-sm">
                    ⚠️ {check.runtime} is not a Lambda runtime we can verify
                    {check.note ? ` (${check.note})` : ''}. The ZIP still downloads fine — deploy it manually if your setup supports it.
                  </div>
                )}
                <div className="mt-4 card-haunt p-4 text-sm text-purple-200">
                  <div className="font-bold text-pumpkin mb-1">☁️ Deploy it yourself</div>
                  <ol className="list-decimal ml-5 space-y-1">
                    <li>Download the ZIP below.</li>
                    <li>AWS Console → Lambda → Create function → Upload from .zip file.</li>
                    {check.ok && <li>Runtime: {check.runtime}. Handler: {check.handler}.</li>}
                  </ol>
                </div>
              </>
            );
          })()}

        </div>
      )}
    </div>
  );
}
