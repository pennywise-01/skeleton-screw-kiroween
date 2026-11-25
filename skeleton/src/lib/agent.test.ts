import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FilesSchema, CodeSchema, ReportSchema, generate, checkProviders } from './agent';

describe('schemas', () => {
  it('FilesSchema validates a files payload', () => {
    const ok = FilesSchema.safeParse({
      files: [{ path: 'a.ts', content: 'x' }],
      explanation: 'done',
    });
    expect(ok.success).toBe(true);
  });

  it('FilesSchema rejects empty files array', () => {
    const bad = FilesSchema.safeParse({ files: [], explanation: 'done' });
    expect(bad.success).toBe(false);
  });

  it('CodeSchema validates a code payload', () => {
    expect(CodeSchema.safeParse({ code: 'x', explanation: 'y' }).success).toBe(true);
  });

  it('ReportSchema validates a report payload', () => {
    expect(ReportSchema.safeParse({ report: 'x', explanation: 'y' }).success).toBe(true);
  });
});

describe('generate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the provider route and returns parsed JSON', async () => {
    const payload = { code: 'fixed', explanation: 'why', provider: 'kiro' };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const result = await generate('kiro', { task: 'fix it', outputSchema: 'code' });

    expect(fetch).toHaveBeenCalledWith('/api/agent/kiro', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(payload);
  });

  it('throws with provider prefix on HTTP error', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      text: async () => 'boom',
    });

    await expect(generate('kiro', { task: 'x', outputSchema: 'code' }))
      .rejects.toThrow('kiro API: boom');
  });
});

describe('checkProviders', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns all-false when status endpoint fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    const status = await checkProviders();
    expect(status).toEqual({ kiro: false, demo: false, preferred: null });
  });

  it('returns all-false when body is empty', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    const status = await checkProviders();
    expect(status).toEqual({ kiro: false, demo: false, preferred: null });
  });

  it('parses a valid status payload', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ kiro: true, openai: false, demo: false, preferred: 'kiro' }),
    });
    const status = await checkProviders();
    expect(status).toEqual({ kiro: true, openai: false, demo: false, preferred: 'kiro' });
  });

  it('returns all-false when fetch throws', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const status = await checkProviders();
    expect(status).toEqual({ kiro: false, demo: false, preferred: null });
  });
});


