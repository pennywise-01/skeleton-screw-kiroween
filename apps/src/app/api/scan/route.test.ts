import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from './route';

beforeAll(() => {
  process.env.DEMO_MODE = 'true';
});

const badFile = {
  name: 'App.tsx',
  content: 'export default function App() { return <img src="logo.png" />; }',
};

const cleanFile = {
  name: 'util.py',
  content: 'def add(a, b):\n    return a + b\n',
};

function req(body: unknown) {
  return { json: async () => body } as never;
}

describe('scan route (demo mode)', () => {
  it('haunts files that contain markup with an <img>', async () => {
    const res = await POST(req({ files: [badFile] }));
    const data = await res.json();
    expect(data.findings.length).toBeGreaterThan(0);
    expect(data.findings[0]).toHaveProperty('ruleId');
    expect(data.findings[0]).toHaveProperty('line');
    expect(data.findings[0]).toHaveProperty('message');
    expect(['error', 'warning']).toContain(data.findings[0].severity);
  });

  it('returns an empty array for empty input', async () => {
    const res = await POST(req({ files: [] }));
    const data = await res.json();
    expect(data.findings).toHaveLength(0);
  });

  it('returns no findings when no file has markup', async () => {
    const res = await POST(req({ files: [cleanFile] }));
    const data = await res.json();
    expect(data.findings).toHaveLength(0);
  });

  it('skips node_modules when picking a haunted file', async () => {
    const files = [
      { name: 'node_modules/pkg/Bad.tsx', content: '<img src="x.png" />' },
      { name: 'src/Good.tsx', content: 'export default function Good() { return <div />; }' },
    ];
    const res = await POST(req({ files }));
    const data = await res.json();
    expect(data.findings).toHaveLength(0);
  });
});
