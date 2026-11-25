import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { isDemoMode, demoScanFindings } from '@/lib/demo';

export const maxDuration = 600;

interface ScanFile {
  name: string;
  content: string;
}

interface Finding {
  file: string;
  line: number;
  col: number;
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
}

export async function POST(req: NextRequest) {
  const { files } = (await req.json()) as { files: ScanFile[] };
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ findings: [] });
  }

  if (isDemoMode()) {
    return NextResponse.json({ findings: demoScanFindings(files) });
  }

  const prompt = buildScanPrompt(files);

  // Streamed response: newline heartbeats keep the socket alive while
  // kiro-cli audits (Node kills sockets idle for 5 minutes).
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('\n'));
        } catch {
          // closed
        }
      }, 15000);

      let killer: ReturnType<typeof setTimeout>;
      const finish = (payload: unknown) => {
        clearInterval(heartbeat);
        clearTimeout(killer);
        try {
          controller.enqueue(encoder.encode(JSON.stringify(payload)));
          controller.close();
        } catch {
          // client went away
        }
      };

      const kiro = spawn('kiro-cli', ['chat', '--no-interactive', '--trust-workspace', prompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      kiro.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      kiro.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      kiro.on('error', (err) => finish({ __error: `kiro-cli not found: ${err.message}` }));

      kiro.on('close', (code) => {
        if (code !== 0) {
          finish({ __error: `kiro-cli exited with code ${code}: ${stderr.slice(0, 400)}` });
          return;
        }
        try {
          const output = stdout.trim();
          const jsonText = extractJsonArray(output);
          if (!jsonText) {
            finish({ __error: `Kiro returned no findings JSON: ${output.slice(0, 300)}` });
            return;
          }
          const parsed = JSON.parse(jsonText) as unknown[];
          const findings: Finding[] = parsed.map((f) => normalizeFinding(f));
          finish({ findings });
        } catch (err) {
          finish({ __error: `Kiro audit parse error: ${(err as Error).message}` });
        }
      });

      killer = setTimeout(() => {
        kiro.kill();
        finish({ __error: 'Kiro audit timed out after 10 minutes. Try fewer files.' });
      }, 600000);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Accel-Buffering': 'no' },
  });
}

function buildScanPrompt(files: ScanFile[]): string {
  // kiro-cli args ride on the Windows command line (~32k limit): cap the payload
  const MAX = 24000;
  let budget = MAX;
  const parts: string[] = [];
  for (const f of files) {
    if (budget <= 0) break;
    const slice = f.content.slice(0, Math.min(f.content.length, budget));
    budget -= slice.length;
    parts.push(`=== ${f.name} ===\n${slice}${slice.length < f.content.length ? '\n...(truncated)' : ''}`);
  }

  return `You are an accessibility auditor. Audit each file for WCAG 2.1 A/AA issues: missing alt text, missing form labels, invalid or ambiguous anchors, skipped heading levels, click handlers without keyboard access, missing lang attributes, ARIA misuse.

Files with no user-interface markup (configs, tests, server code, JSON) usually have NO issues — report nothing for them. Never invent issues.

Return ONLY a JSON array, no prose, no code fences:
[{"file":"name","line":1,"col":1,"ruleId":"short-rule","severity":"error","message":"what is wrong and how to fix it"}]

If nothing is wrong anywhere, return [].

FILES:
${parts.join('\n\n')}`;
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeFinding(raw: unknown): Finding {
  const f = (raw ?? {}) as Record<string, unknown>;
  return {
    file: String(f.file ?? 'unknown'),
    line: Number(f.line) || 0,
    col: Number(f.col) || 0,
    ruleId: String(f.ruleId ?? f.rule ?? 'ai-finding'),
    severity: f.severity === 'error' ? 'error' : 'warning',
    message: String(f.message ?? f.description ?? ''),
  };
}
