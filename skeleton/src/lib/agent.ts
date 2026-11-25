import { z } from 'zod';

export interface AgentRequest {
  task: string;
  context?: string;
  outputSchema: 'files' | 'code' | 'report';
}

export const FilesSchema = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })).min(1),
  explanation: z.string(),
});

export const CodeSchema = z.object({ 
  code: z.string(), 
  explanation: z.string() 
});

export const ReportSchema = z.object({ 
  report: z.string(), 
  explanation: z.string() 
});

export type AgentResult =
  | { files: Array<{ path: string; content: string }>; explanation: string; provider: string }
  | { code: string; explanation: string; provider: string }
  | { report: string; explanation: string; provider: string };

// Client-side generator (calls server API routes)
export async function generate(provider: 'kiro', req: AgentRequest): Promise<AgentResult> {
  const res = await fetch(`/api/agent/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`${provider} API: ${error}`);
  }
  
  const data = await res.json();
  // Streamed routes report failures in-band (heartbeats force status 200)
  if (data && typeof data === 'object' && '__error' in data) {
    throw new Error(`${provider} API: ${(data as { __error: string }).__error}`);
  }
  return data;
}

// Helper for the client to check whether kiro-cli is available
export async function checkProviders(): Promise<{ kiro: boolean; demo: boolean; preferred: 'kiro' | null }> {
  try {
    const res = await fetch('/api/agent/status');
    if (!res.ok) return { kiro: false, demo: false, preferred: null };
    const text = await res.text();
    if (!text) return { kiro: false, demo: false, preferred: null };
    return JSON.parse(text);
  } catch (err) {
    console.error('Error checking providers:', err);
    return { kiro: false, demo: false, preferred: null };
  }
}
