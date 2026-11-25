'use client';
import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import JSZip from 'jszip';

interface FileUploadProps {
  accept?: Record<string, string[]>;
  maxSize?: number;
  onFiles: (files: Array<{ name: string; content: string }>) => void;
}

const SKIP_DIRS = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', 'coverage/', 'vendor/bundle/'];
const BINARY_EXT = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.jar',
  '.class', '.pyc', '.exe', '.dll', '.so', '.dylib', '.gem', '.whl',
  '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.mov',
];

async function extractZip(file: File): Promise<Array<{ name: string; content: string }>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((e) => {
    if (e.dir) return false;
    const lower = e.name.toLowerCase();
    if (SKIP_DIRS.some((d) => lower.includes(d))) return false;
    // Keep every text file, skip only known binary formats
    return !BINARY_EXT.some((ext) => lower.endsWith(ext));
  });
  return Promise.all(
    entries.map(async (e) => ({ name: e.name, content: await e.async('string') }))
  );
}

export function FileUpload({ accept, maxSize = 1 * 1024 * 1024, onFiles }: FileUploadProps) {
  const [ready, setReady] = useState(0);
  const [error, setError] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const parsed = (
      await Promise.all(
        acceptedFiles.map(async (f) =>
          f.name.toLowerCase().endsWith('.zip')
            ? extractZip(f)
            : [{ name: f.name, content: await f.text() }]
        )
      )
    ).flat();
    setReady(parsed.length);
    setError('');
    onFiles(parsed);
  }, [onFiles]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const limitMb = Math.round(maxSize / (1024 * 1024));
    const msgs = rejections.map((r) => {
      if (r.errors.some((e) => e.code === 'file-too-large')) {
        return `${r.file.name} exceeds the ${limitMb}MB limit`;
      }
      return `${r.file.name}: type not supported`;
    });
    setError(msgs.join(' · '));
  }, [maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept,
    maxSize,
  });

  const acceptedExt = accept
    ? [...new Set(Object.values(accept).flat())].join(' ')
    : 'all files';

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
        isDragActive
          ? 'border-[#39ff14] bg-[#1a0b2e] shadow-[0_0_24px_rgba(57,255,20,0.35)]'
          : 'border-[#8b5cf6] bg-[rgba(26,11,46,0.6)] hover:border-[#ff7518]'
      }`}
    >
      <input {...getInputProps()} aria-label="File upload" />
      {error ? (
        <div className="text-red-400">💀 {error}</div>
      ) : ready > 0 ? (
        <div className="text-[#e9e4f5]">✅ {ready} file{ready === 1 ? '' : 's'} ready</div>
      ) : (
        <div>
          <div className="text-purple-300">🎃 Drag files or a .zip into the cauldron, or click to browse</div>
          <div className="text-xs text-purple-400 mt-2">
            Accepts {acceptedExt} · max {Math.round(maxSize / (1024 * 1024))}MB
          </div>
        </div>
      )}
    </div>
  );
}
