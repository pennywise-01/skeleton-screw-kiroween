# 🦴 Skeleton Crew — Web App Implementation Spec

> Code-level build spec: every module, its key code, and how it wires to the others. Competition strategy/timeline/video live in [HACKATHON.md](./HACKATHON.md).
>
> **Do not write code before Oct 30, 2026** (eligibility rule). This is the Day 1 build spec.
>
> **Architecture change (Oct 30):** Web app instead of CLI. One React component library (skeleton), two Next.js apps using it.

---

## 0. Project Structure

**Architecture decision:** One Next.js app with two route-based applications.

```
kiroween/
├── skeleton/                  # The reusable component library
│   ├── src/
│   │   ├── components/       # AgentProvider, FileUpload, CodePreview, SpecEditor
│   │   ├── hooks/            # useAgent, useFileValidation, useDiffPreview
│   │   ├── lib/              # agent client (transport-agnostic), zod schemas
│   │   └── index.ts          # Public exports
│   ├── package.json
│   └── tsconfig.json
├── apps/                     # Single Next.js app with both applications
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout with AgentProvider
│   │   │   ├── page.tsx              # Landing page (server component)
│   │   │   ├── lambda/
│   │   │   │   ├── page.tsx          # App 1: Serverless scaffolder
│   │   │   │   └── lib/              # AWS helpers (Lambda-specific)
│   │   │   ├── a11y/
│   │   │   │   ├── page.tsx          # App 2: Accessibility auditor
│   │   │   │   └── lib/              # ESLint/parse5 engines (a11y-specific)
│   │   │   └── api/
│   │   │       ├── agent/
│   │   │       │   ├── status/route.ts   # Returns { kiro: bool, openai: bool }
│   │   │       │   ├── kiro/route.ts     # Server-only KIRO_API_KEY
│   │   │       │   └── openai/route.ts   # Server-only OPENAI_API_KEY
│   │   │       ├── deploy/route.ts       # AWS Lambda deploy
│   │   │       ├── scan/route.ts         # A11y scan
│   │   │       └── clone/route.ts        # Download skeleton starter
│   │   └── components/               # Shared UI (layout, nav)
│   ├── public/
│   │   └── skeleton-starter.zip      # Pre-built at build time
│   ├── package.json                  # depends on "skeleton": "file:../skeleton"
│   ├── next.config.js
│   └── .eslintrc.js                  # Enforces no cross-app imports
└── README.md
```

**Why this satisfies "two distinct applications":**

The competition requires "two distinct applications from your foundation." This structure delivers that:

1. **Physical separation:** `/lambda` and `/a11y` are separate Next.js routes with their own page components, workflows, and domain logic.
2. **Domain separation:** Lambda app imports AWS SDK and deploys functions. A11y app imports ESLint and scans code. No shared domain logic.
3. **Independent operation:** Each app works standalone. You can delete `/lambda` and `/a11y` still functions.
4. **Enforced boundaries:** ESLint `no-restricted-imports` prevents `/lambda` from importing `/a11y` and vice versa.

They share infrastructure (the skeleton + Next.js routing) but not domain code. This is **better** than two separate repos: judges see both apps in one deployed URL without context-switching.

**ESLint boundary enforcement:**

```js
// apps/.eslintrc.js
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/lambda/**'],
          message: 'A11y app cannot import from Lambda app. Import from skeleton instead.',
        },
        {
          group: ['**/a11y/**'],
          message: 'Lambda app cannot import from A11y app. Import from skeleton instead.',
        },
      ],
    }],
  },
  overrides: [
    {
      files: ['src/app/lambda/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['**/a11y/**'],
        }],
      },
    },
    {
      files: ['src/app/a11y/**/*'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: ['**/lambda/**'],
        }],
      },
    },
  ],
};
```

**Deployment:** One Vercel deploy → `skeleton.vercel.app` with `/`, `/lambda`, `/a11y` routes.

---

## 1. The Skeleton (`skeleton/`)

### 1.1 `skeleton/src/components/AgentProvider.tsx` — provider switcher

```tsx
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { generate as generateApi, checkProviders, type AgentRequest, type AgentResult } from '../lib/agent';

interface AgentContextValue {
  provider: 'kiro' | 'openai';
  setProvider: (p: 'kiro' | 'openai') => void;
  generate: (req: AgentRequest) => Promise<AgentResult>;
  available: { kiro: boolean; openai: boolean };
  ready: boolean;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<'kiro' | 'openai'>('openai'); // OpenAI default until Kiro verified
  const [available, setAvailable] = useState({ kiro: false, openai: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkProviders().then((status) => {
      setAvailable(status);
      // Auto-select first available provider
      if (status.kiro) setProvider('kiro');
      else if (status.openai) setProvider('openai');
      setReady(true);
    });
  }, []);

  const generate = async (req: AgentRequest) => {
    if (!available[provider]) {
      throw new Error(`${provider} is not configured. Check your API keys.`);
    }
    return generateApi(provider, req);
  };

  return (
    <AgentContext.Provider value={{ provider, setProvider, generate, available, ready }}>
      {children}
    </AgentContext.Provider>
  );
}

export const useAgent = () => {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
};
```

### 1.2 `skeleton/src/lib/agent.ts` — the API layer (transport-agnostic)

```ts
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
export const CodeSchema = z.object({ code: z.string(), explanation: z.string() });
export const ReportSchema = z.object({ report: z.string(), explanation: z.string() });

export type AgentResult =
  | { files: Array<{ path: string; content: string }>; explanation: string; provider: string }
  | { code: string; explanation: string; provider: string }
  | { report: string; explanation: string; provider: string };

// Client-side generator (calls server API routes)
export async function generate(provider: 'kiro' | 'openai', req: AgentRequest): Promise<AgentResult> {
  const res = await fetch(`/api/agent/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`${provider} API: ${error}`);
  }
  return res.json(); // Server returns validated, typed JSON
}

// Helper for the client to check which providers are available
export async function checkProviders(): Promise<{ kiro: boolean; openai: boolean }> {
  const res = await fetch('/api/agent/status');
  return res.json();
}
```

**No hardcoded routes or secrets.** Apps inject the base URL if needed; API routes handle credentials.

### 1.3 `skeleton/src/components/FileUpload.tsx` — drag-drop

```tsx
'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  accept?: Record<string, string[]>;
  maxSize?: number;
  onFiles: (files: Array<{ name: string; content: string }>) => void;
}

export function FileUpload({ accept, maxSize = 5 * 1024 * 1024, onFiles }: FileUploadProps) {
  const [files, setFiles] = useState<Array<{ name: string; size: number }>>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const parsed = await Promise.all(
      acceptedFiles.map(async (f) => ({
        name: f.name,
        content: await f.text(),
      }))
    );
    setFiles(acceptedFiles.map((f) => ({ name: f.name, size: f.size })));
    onFiles(parsed);
  }, [onFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
        isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
      }`}
    >
      <input {...getInputProps()} />
      {files.length ? (
        <div>✅ {files.length} files uploaded</div>
      ) : (
        <div>Drag files here, or click to browse</div>
      )}
    </div>
  );
}
```

### 1.4 `skeleton/src/components/CodePreview.tsx` — syntax-highlighted diff

```tsx
'use client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import * as Diff from 'diff';

interface CodePreviewProps {
  before?: string;
  after: string;
  language: string;
  showDiff?: boolean;
}

export function CodePreview({ before, after, language, showDiff }: CodePreviewProps) {
  if (!showDiff || !before) {
    return (
      <SyntaxHighlighter language={language} style={vscDarkPlus}>
        {after}
      </SyntaxHighlighter>
    );
  }

  const diff = Diff.createPatch('file', before, after);
  return (
    <SyntaxHighlighter language="diff" style={vscDarkPlus}>
      {diff}
    </SyntaxHighlighter>
  );
}
```

### 1.5 `skeleton/src/components/SpecEditor.tsx` — markdown editor

```tsx
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SpecEditorProps {
  initialValue?: string;
  onChange: (value: string) => void;
}

export function SpecEditor({ initialValue = '', onChange }: SpecEditorProps) {
  const [value, setValue] = useState(initialValue);
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-2">
        <button onClick={() => setPreview(false)} className={!preview ? 'font-bold' : ''}>
          Edit
        </button>
        <button onClick={() => setPreview(true)} className={preview ? 'font-bold' : ''}>
          Preview
        </button>
      </div>
      {preview ? (
        <div className="prose max-w-none">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value);
          }}
          className="flex-1 font-mono text-sm border rounded p-2"
        />
      )}
    </div>
  );
}
```

### 1.6 `skeleton/package.json` — what gets published
import { fatal } from './core/errors.js';

createProgram()
  .then((p) => p.parseAsync(process.argv))
  .catch(fatal);   // last-resort catch: themed message, exit 1 (or 2 for usage)
```

**Wires to:** `core/cli.ts` (boot), `core/errors.ts` (top-level failure). Nothing else — the entry point stays at these ~8 lines so `tsup` produces a clean bin.

---

## 2. Core Modules

### 2.1 `core/config.ts` — resolution chain

Owns all configuration. One merge, one source of truth; nothing else in the codebase reads `process.env` directly.

```ts
export interface ResolvedConfig {
  agent: { provider?: 'kiro' | 'openai' | 'mock'; model?: string; timeoutMs: number };
  aws:   { region?: string; profile?: string; deployBucket?: string; roleArn?: string };
  flags: { json: boolean; verbose: boolean; mockAgent: boolean };
}

const FileConfig = z.object({
  agent: z.object({ provider: z.enum(['kiro','openai']), model: z.string().optional() }).partial().optional(),
  aws:   z.object({ region: z.string(), profile: z.string(), deployBucket: z.string() }).partial().optional(),
}).partial();

export async function resolveConfig(cliFlags: GlobalFlags): Promise<ResolvedConfig> {
  const file = await loadJsonIfExists('skeleton.config.json', FileConfig);
  return {
    agent: {
      provider:  cliFlags.agent ?? env('AGENT_PROVIDER') ?? file.agent?.provider,   // undefined = auto-detect
      model:     cliFlags.model ?? env('AGENT_MODEL') ?? file.agent?.model,
      timeoutMs: Number(env('AGENT_TIMEOUT_MS') ?? 120_000),
    },
    aws: {
      region:  cliFlags.region ?? env('AWS_REGION') ?? env('AWS_DEFAULT_REGION') ?? file.aws?.region ?? 'us-east-1',
      profile: cliFlags.profile ?? env('AWS_PROFILE') ?? file.aws?.profile,
      deployBucket: env('SKELETON_DEPLOY_BUCKET') ?? file.aws?.deployBucket,
      roleArn: env('SKELETON_ROLE_ARN') ?? undefined,
    },
    flags: { json: !!cliFlags.json, verbose: !!cliFlags.verbose, mockAgent: !!cliFlags.mockAgent },
  };
}
```

**Wires to:** called once by `core/cli.ts`; result rides in `CoreContext` so every command reads `ctx.config` instead of env. `zod` here means a malformed `skeleton.config.json` fails with a readable message at boot, not a crash mid-command.

---

### 2.2 `core/agent.ts` — provider interface + 3 providers

```ts
export interface AgentRequest {
  task: string;                          // instruction text
  context?: string;                      // spec / file contents / prior error output
  outputSchema: 'files' | 'code' | 'report';
  trustTools?: string[];                 // kiro only: mapped to --trust-tools
  timeoutMs?: number;
}
export interface AgentResult {
  files?: Array<{ path: string; content: string }>;
  code?: string;
  explanation: string;
  provider: string;
}
export interface AgentProvider {
  name: string;
  isAvailable(): Promise<boolean>;       // cheap probe — used by selectProvider + doctor
  generate(req: AgentRequest): Promise<AgentResult>;
}
```

**KiroCliProvider** — the default. Key implementation points:

```ts
export class KiroCliProvider implements AgentProvider {
  name = 'kiro-cli';
  async isAvailable() {
    return Boolean(process.env.KIRO_API_KEY) && (await which('kiro-cli', { nothrow: true })) !== null;
  }
  async generate(req: AgentRequest): Promise<AgentResult> {
    const args = ['chat', '--no-interactive'];
    if (req.trustTools?.length) args.push('--trust-tools', req.trustTools.join(','));  // least privilege, per command
    args.push(buildPrompt(req));                       // task + context + sentinel protocol instructions
    const { stdout } = await execa('kiro-cli', args, { // arg ARRAY — no shell, no injection
      timeout: req.timeoutMs ?? 120_000,
      env: { KIRO_API_KEY: process.env.KIRO_API_KEY },
    });
    return parseAgentOutput(stdout, req.outputSchema, this.name);
  }
}
```

**OpenAiProvider** — same shape, `fetch` POST to `${baseUrl}/chat/completions` (`baseUrl` default `https://api.openai.com/v1`, overridable → works with Bedrock proxies, Ollama, etc.). `response_format: { type: 'json_object' }`, then the **same** `parseAgentOutput()`. One parser for all providers is deliberate: the wire protocol is ours, not the vendor's.

**MockProvider** — `generate()` hashes `req.task`, reads `tests/fixtures/agent/<hash>.json`. Activated by `--mock-agent`. Gives deterministic integration tests and an offline demo mode.

**Selection:**

```ts
export async function selectProvider(config: ResolvedConfig): Promise<AgentProvider> {
  if (config.flags.mockAgent) return new MockProvider();
  const candidates: AgentProvider[] =
    config.agent.provider === 'openai' ? [new OpenAiProvider(config)] :
    config.agent.provider === 'kiro'   ? [new KiroCliProvider()] :
                                         [new KiroCliProvider(), new OpenAiProvider(config)]; // auto
  for (const p of candidates) if (await p.isAvailable()) return p;
  throw new SkeletonError('No agent provider available.', 'Run `bones doctor` to see what is missing.');
}
```

**Wires to:** `agent-parse.ts` (parsing), `config.ts` (input), `errors.ts` (SkeletonError). Consumed by: `lambda/create` (spec + codegen), `a11y/fix` (refactor), `spawn` (not needed — pure templating), `doctor` (probes `isAvailable()` on each provider without selecting).

---

### 2.3 `core/agent-parse.ts` — the wire protocol

Never parse free-form LLM prose. Providers are instructed (via `buildPrompt`) to wrap output in sentinels; we extract and validate:

```ts
const FilesSchema = z.object({
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1),
  explanation: z.string(),
});
const CodeSchema   = z.object({ code: z.string(), explanation: z.string() });
const ReportSchema = z.object({ report: z.string(), explanation: z.string() });

export function parseAgentOutput(raw: string, kind: AgentRequest['outputSchema'], provider: string): AgentResult {
  const m = raw.match(/<<<SKELETON_JSON>>>([\s\S]*?)<<<END>>>/);
  if (!m) throw new SkeletonError(`${provider} returned no structured payload.`, 'Retry, or switch provider with --agent.');
  const schema = { files: FilesSchema, code: CodeSchema, report: ReportSchema }[kind];
  return { ...schema.parse(JSON.parse(m[1])), provider };  // zod errors bubble as validation failures
}

// Retry wrapper — the ONLY way commands call the agent:
export async function generateValid(agent: AgentProvider, req: AgentRequest, retries = 1): Promise<AgentResult> {
  for (let attempt = 0; ; attempt++) {
    try { return await agent.generate(req); }
    catch (err) {
      if (attempt >= retries || !(err instanceof SkeletonError)) throw err;
      req = { ...req, context: `${req.context ?? ''}\n\nYour previous output failed validation: ${err.message}. Return ONLY the sentinel-wrapped JSON.` };
    }
  }
}
```

**Wires to:** used *inside* every provider (`agent.ts`) and *by every command* via `generateValid` (this is the seam that gives every command schema-safe output + one self-correction retry for free).

---

### 2.4 `core/fs-utils.ts` — untrusted-input-safe writes

Agent output is untrusted input. Every write in the whole CLI funnels through here.

```ts
export function resolveInside(root: string, relPath: string): string {
  const abs = path.resolve(root, relPath);
  if (!abs.startsWith(path.resolve(root) + path.sep))
    throw new SkeletonError(`Refusing to write outside target: ${relPath}`);
  return abs;
}

export function safeWrite(root: string, relPath: string, content: string, opts?: { backup?: boolean }): void {
  const abs = resolveInside(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (opts?.backup && fs.existsSync(abs)) fs.copyFileSync(abs, abs + '.bak');
  const tmp = abs + '.tmp-' + process.pid;         // atomic: write tmp, then rename
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, abs);
}

export function writeTree(root: string, files: Array<{ path: string; content: string }>): string[] {
  return files.map((f) => { safeWrite(root, f.path, f.content); return f.path; });
}
```

**Wires to:** `lambda/create` (`writeTree`), `a11y/fix` (`safeWrite` with `backup`), `spawn` (template copying goes through `safeWrite` too — a compromised template can't escape the target dir), `errors.ts`.

---

### 2.5 `core/aws.ts` — credential chain + the IAM fix

```ts
export interface AwsClients { lambda: LambdaClient; s3: S3Client; iam: IamClient; region: string; }

export async function getAwsClients(config: ResolvedConfig['aws']): Promise<AwsClients> {
  const credentials = config.profile ? fromIni({ profile: config.profile }) : undefined; // else default chain
  const base = { region: config.region, credentials };
  const clients = { lambda: new LambdaClient(base), s3: new S3Client(base), iam: new IamClient(base), region: config.region };
  await clients.lambda.config.credentials();   // force-resolve now → fail themed & early, not mid-deploy
  return clients;
}
```

**`findOrCreateExecutionRole`** — the piece the original plan missed; without it `CreateFunction` fails on every fresh account:

```ts
const ROLE_NAME = 'skeleton-lambda-role';
const ASSUME = JSON.stringify({ Version: '2012-10-17', Statement: [{
  Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] });

export async function findOrCreateExecutionRole(c: AwsClients): Promise<string> {
  try {
    return (await c.iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }))).Role!.Arn!;
  } catch (err) {
    if ((err as Error).name !== 'NoSuchEntityException') throw err;
  }
  const role = await c.iam.send(new CreateRoleCommand({ RoleName: ROLE_NAME, AssumeRolePolicyDocument: ASSUME }));
  await c.iam.send(new AttachRolePolicyCommand({
    RoleName: ROLE_NAME, PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' }));
  // IAM is eventually consistent — poll until Lambda can see the role, max ~15s
  await waitForRolePropagation(c, ROLE_NAME);
  return role.Role!.Arn!;
}
```

Also exports `uploadZip(clients, bucket, key, buf)` and `ensureDeployBucket(clients, name)` (create-if-missing, used when a zip exceeds Lambda's 50 MB direct-upload limit).

**Wires to:** `config.ts` (region/profile/roleArn input), consumed only by `commands/lambda/deploy.ts` and `destroy.ts`. `doctor` calls `getAwsClients` inside a try/catch to report credential health without failing the check.

---

### 2.6 `core/ui.ts` — theme primitives

Generic building blocks only; domain strings live in commands.

```ts
export const theme = {
  purple: chalk.hex('#8b5cf6'), green: chalk.hex('#39ff14'), dim: chalk.gray,
  spin(text: string): Ora { return ora({ text, spinner: 'dots12', color: 'magenta' }).start(); },
  ok:    (msg: string) => console.log(chalk.green(figures.tick), msg),
  warn:  (msg: string) => console.log(chalk.yellow(figures.warning), msg),
  fail:  (msg: string) => console.error(chalk.red(figures.cross), msg),
  banner(): void { /* one ASCII banner, printed on bare `bones` only — never in --json mode */ },
  diffLine(line: string): string { /* + green / - red / @ dim — used by a11y fix preview */ },
};
export type Theme = typeof theme;
```

**Wires to:** everything user-facing. Rule: commands never import `chalk`/`ora` directly — they import `ctx.ui`. That's what makes re-theming (and silencing for `--json`) a one-file change. `--json` mode: `cli.ts` swaps in a muted theme where `spin/ok/warn` are no-ops.

---

### 2.7 `core/errors.ts` — failure model

```ts
export class SkeletonError extends Error {
  constructor(message: string, public hint?: string, public exitCode = 1) { super(message); }
}

export function withErrors<T extends unknown[]>(            // wraps every command action
  fn: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args) => { try { await fn(...args); } catch (err) { fatal(err); } };
}

export function fatal(err: unknown): never {
  if (err instanceof SkeletonError) {
    theme.fail(err.message);
    if (err.hint) console.log(theme.dim('  → ' + err.hint));   // every error ends with the exact next step
  } else {
    theme.fail('Unexpected error.');
    if (process.env.SKELETON_VERBOSE) console.error(err);       // stack only in verbose
  }
  process.exit(err instanceof SkeletonError ? err.exitCode : 1);
}
```

**Wires to:** thrown by `agent-parse`, `fs-utils`, `agent` selection; caught by `withErrors` around every command action and by the `index.ts` catch-all. This is why no command ever writes its own try/catch-and-print boilerplate.

---

## 3. Command Packs

Each pack exports `register(program, ctx)`. `core/cli.ts` collects them:

```ts
// core/cli.ts (full boot)
export async function createProgram(): Promise<Command> {
  const program = new Command().name('bones').description('One skeleton. Many bodies.').version(pkg.version);
  program.option('--agent <provider>').option('--json').option('--verbose')
         .option('--region <r>').option('--profile <p>').option('--mock-agent');
  const config = await resolveConfig(program.opts());
  const ctx: CoreContext = { agent: await selectProvider(config), ui: config.flags.json ? mutedTheme : theme, config };
  registerLambda(program, ctx);
  registerA11y(program, ctx);
  registerSpawn(program, ctx);
  registerDoctor(program);            // no ctx — must work in a broken environment
  return program;
}
```

### 3.1 `commands/lambda/create.ts` — prompt → spec → code → tested project

```ts
export function registerLambda(program: Command, ctx: CoreContext): void {
  const lambda = program.command('lambda').description('Serverless scaffolder');

  lambda.command('create').requiredOption('--name <name>').requiredOption('--prompt <prompt>')
    .option('--dir <dir>', 'output dir', process.cwd())
    .action(withErrors(async (opts) => {
      const outDir = path.join(opts.dir, opts.name);
      if (fs.existsSync(outDir)) throw new SkeletonError(`${opts.name} already exists.`, 'Pick another --name or --dir.');

      // 1. SPEC (Kiro philosophy: spec before code). 'code' schema → markdown doc.
      let s = ctx.ui.spin('📜 Summoning the spec…');
      const spec = await generateValid(ctx.agent, {
        task: specTask(opts.name, opts.prompt),      // prompt template from templates/lambda/spec.prompt.ts
        outputSchema: 'code',
      });
      safeWrite(outDir, 'SPEC.md', spec.code!);
      s.succeed('Spec materialized → SPEC.md');

      // 2. CODEGEN — spec rides back in as context. 'files' schema.
      s = ctx.ui.spin('⚰️ Raising the dead code…');
      const gen = await generateValid(ctx.agent, {
        task: codegenTask(),                          // "implement per templates/lambda conventions"
        context: spec.code,
        outputSchema: 'files',
      });
      const written = writeTree(outDir, gen.files!);  // traversal-safe, from core/fs-utils
      s.succeed(`${written.length} files risen`);

      // 3. INSTALL + TEST, with one self-healing loop
      s = ctx.ui.spin('🧪 Running the trials…');
      const test = await installAndTest(outDir);      // execa npm install → npx vitest run
      if (!test.ok) {
        s.warn('Trials failed — consulting the spirits…');
        const healed = await generateValid(ctx.agent, {
          task: healTask(), context: `SPEC:\n${spec.code}\n\nTEST OUTPUT:\n${test.output}`, outputSchema: 'files' });
        writeTree(outDir, healed.files!);
        const retest = await installAndTest(outDir);
        if (!retest.ok) throw new SkeletonError('Generated code still fails its tests.', retest.output);
      }
      s.succeed('All trials passed');

      ctx.ui.ok(`Created ${opts.name} ⚡ via ${gen.provider}`);
      printTree(outDir, written);                     // ctx.ui helpers
      console.log(ctx.ui.dim(`\nDeploy with: bones lambda deploy --name ${opts.name}`));
    }));
}
```

**Wiring:** `core/agent` (via `generateValid`) twice + once optionally, `core/fs-utils` for all writes, `core/ui` for all output, `core/errors` via `withErrors`. **No AWS imports at all** — `create` works fully offline, which is what lets judges run it without an AWS account.

### 3.2 `commands/lambda/deploy.ts` — zip → (S3) → create/update

```ts
lambda.command('deploy').requiredOption('--name <name>')
  .option('--dir <dir>', process.cwd()).option('--role-arn <arn>').option('--invoke')
  .action(withErrors(async (opts) => {
    const dir = path.join(opts.dir, opts.name);
    const aws = await getAwsClients(ctx.config.aws);            // fails themed & early on missing creds

    let s = ctx.ui.spin('⚰️ Packaging…');
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'bones-'));
    await execa('npm', ['ci', '--omit=dev'], { cwd: staging }); // prod-only node_modules in staging
    const zip = await zipDir(staging);                          // archiver → Buffer
    s.succeed(`Packaged (${(zip.length / 1e6).toFixed(1)} MB)`);

    const roleArn = opts.roleArn ?? ctx.config.aws.roleArn ?? await findOrCreateExecutionRole(aws);

    let code: { ZipFile?: Buffer; S3Bucket?: string; S3Key?: string } = { ZipFile: zip };
    if (zip.length > 50 * 1024 * 1024) {                        // Lambda direct-upload limit
      s = ctx.ui.spin('🪦 Uploading to S3…');
      const bucket = ctx.config.aws.deployBucket ?? await ensureDeployBucket(aws, `bones-deploy-${await accountId(aws)}`);
      await uploadZip(aws, bucket, `${opts.name}.zip`, zip);
      code = { S3Bucket: bucket, S3Key: `${opts.name}.zip` };
      s.succeed('Uploaded');
    }

    s = ctx.ui.spin('👻 Haunting AWS…');
    const exists = await getFunction(aws, opts.name);           // GetFunction → null on 404
    if (exists) {
      await aws.lambda.send(new UpdateFunctionCodeCommand({ FunctionName: opts.name, ...code }));
    } else {
      await aws.lambda.send(new CreateFunctionCommand({
        FunctionName: opts.name, Runtime: 'nodejs20.x', Handler: 'handler.handler',
        Role: roleArn, Code: code }));
    }
    await waitUntilFunctionActiveV2({ client: aws.lambda, maxWaitTime: 120 }, { FunctionName: opts.name });
    const fn = await aws.lambda.send(new GetFunctionCommand({ FunctionName: opts.name }));
    s.succeed(`✅ Risen: ${fn.Configuration!.FunctionArn}`);

    if (opts.invoke) {
      const out = await aws.lambda.send(new InvokeCommand({ FunctionName: opts.name, Payload: '{}' }));
      console.log(JSON.parse(Buffer.from(out.Payload!).toString()));
    }
  }));
```

**Wiring:** the only consumer of `core/aws.ts` (+ `destroy`). Reuses `ctx.config.aws` resolved at boot. Everything past `getAwsClients` is plain SDK calls — the skeleton's contribution is config, credentials, role provisioning, and the themed lifecycle.

### 3.3 `commands/lambda/destroy.ts` — teardown

```ts
lambda.command('destroy').requiredOption('--name <name>').option('--delete-role')
  .action(withErrors(async (opts) => {
    const aws = await getAwsClients(ctx.config.aws);
    if (!await getFunction(aws, opts.name))
      return ctx.ui.ok(`${opts.name} is already at rest. 🪦`);         // idempotent
    await aws.lambda.send(new DeleteFunctionCommand({ FunctionName: opts.name }));
    ctx.ui.ok(`⚰️ ${opts.name} returned to the grave.`);
    if (opts.deleteRole) await deleteRoleIfOurs(aws);                    // only skeleton-lambda-role, never arbitrary
    else ctx.ui.warn(`Role skeleton-lambda-role left in place (--delete-role to remove).`);
  }));
```

### 3.4 `commands/a11y/scan.ts` — two engines, one finding model

The app's internal structure (all inside `commands/a11y/` — this is domain logic, not core):

```
a11y/
├── index.ts        # registerA11y(program, ctx)
├── findings.ts     # Finding type + reporters
├── engine-jsx.ts   # ESLint + eslint-plugin-jsx-a11y
├── engine-html.ts  # parse5 + rule set
├── scan.ts         # orchestration
└── fix.ts          # agent fix loop
```

```ts
// findings.ts — the shared currency of scan, fix, and the reporter
export interface Finding { file: string; line: number; col: number; ruleId: string;
                           severity: 'error' | 'warning'; message: string; fixable: boolean; }

// engine-jsx.ts — real static analysis, no regex
export async function scanJsx(files: string[]): Promise<Finding[]> {
  const eslint = new ESLint({
    overrideConfigFile: true,                        // flat config; ignore the user's project config
    overrideConfig: { plugins: { 'jsx-a11y': jsxA11y },
      rules: Object.fromEntries(                     // recommended set → 'error'
        Object.keys(jsxA11y.configs.recommended.rules ?? {}).map((r) => [r, 'error'])),
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  });
  const results = await eslint.lintFiles(files);
  return results.flatMap((r) => r.messages.map((m) => ({
    file: r.filePath, line: m.line, col: m.column, ruleId: m.ruleId ?? 'unknown',
    severity: m.severity === 2 ? 'error' : 'warning', message: m.message, fixable: FIXABLE.has(m.ruleId ?? ''),
  })));
}

// engine-html.ts — parse5 walk; rules are small visitor fns over the AST
const htmlRules: Rule[] = [imgAlt, htmlLang, inputHasLabel, headingOrder, onclickNeedsKey];
export async function scanHtml(files: string[]): Promise<Finding[]> {
  return files.flatMap((file) => {
    const doc = parse5.parse(fs.readFileSync(file, 'utf8'), { sourceCodeLocationInfo: true });
    return walk(doc).flatMap((node) => htmlRules.flatMap((rule) => rule(node, file) ?? []));
  });
}
```

```ts
// scan.ts — orchestration + reporting
a11y.command('scan').argument('<paths...>')
  .option('--json').option('--fixable')
  .action(withErrors(async (paths: string[], opts) => {
    const s = ctx.ui.spin('🕸️ Scanning for a11y ghosts…');
    const files = await globby(paths.map((p) => `${p}/**/*.{tsx,jsx,html}`));
    const [jsx, html] = await Promise.all([
      scanJsx(files.filter((f) => /\.[jt]sx$/.test(f))),
      scanHtml(files.filter((f) => f.endsWith('.html'))),
    ]);
    let findings = [...jsx, ...html];
    if (opts.fixable) findings = findings.filter((f) => f.fixable);
    s.stop();

    if (opts.json || ctx.config.flags.json) return console.log(JSON.stringify(findings, null, 2));
    printFindings(ctx.ui, findings);                  // grouped by file, severity-colored
    const errors = findings.filter((f) => f.severity === 'error').length;
    ctx.ui[errors ? 'fail' : 'ok'](
      `🕸️ ${findings.length} ghosts in ${new Set(findings.map((f) => f.file)).size} files (${errors} errors)`);
    if (errors) process.exitCode = 1;                 // CI-usable — never process.exit here, let teardown finish
  }));
```

### 3.5 `commands/a11y/fix.ts` — the agent fix loop

```ts
a11y.command('fix').argument('<file>')
  .option('--yes').option('--dry-run').option('--force')
  .action(withErrors(async (file: string, opts) => {
    // 1. SAFETY GATE — dirty git tree? refuse. Not a repo? we'll need a .bak.
    const repo = await gitRoot(file);                                  // execa git rev-parse; null = not a repo
    if (repo && !opts.force && (await execa('git', ['status', '--porcelain', '--', file])).stdout)
      throw new SkeletonError(`${file} has uncommitted changes.`, 'Commit first, or pass --force.');

    // 2. FIND — reuse scan's engines on this one file (same-app import: allowed)
    const findings = (await scanFiles([file])).filter((f) => f.fixable);
    if (!findings.length) return ctx.ui.ok('No fixable ghosts here. 👻');

    // 3. AGENT — we ask for code only; trustTools: [] because WE write the file, not the agent
    const s = ctx.ui.spin(`🔮 Exorcising ${findings.length} ghosts…`);
    const fixed = await generateValid(ctx.agent, {
      task: a11yFixTask(findings),                    // "fix ONLY these violations; no logic/style/API changes"
      context: fs.readFileSync(file, 'utf8'),
      outputSchema: 'code',
      trustTools: [],                                 // least privilege, explicit
    });
    const newCode = fixed.code!;
    await assertParses(file, newCode);                // esbuild transform on a temp copy —
    s.stop();                                         // never write broken code over working code

    // 4. DIFF PREVIEW — default path is human-approved
    printColoredDiff(ctx.ui, Diff.createTwoFilesPatch(file, file, fs.readFileSync(file, 'utf8'), newCode));
    if (opts.dryRun) return ctx.ui.ok('Dry run — no file touched.');
    if (!opts.yes && !(await prompts({ type: 'confirm', name: 'ok', message: 'Apply this fix?' })).ok)
      return ctx.ui.warn('Banished. No changes made.');

    // 5. WRITE (backup only outside git — git IS the backup) + VERIFY with a re-scan
    safeWrite(path.dirname(file), path.basename(file), newCode, { backup: !repo });
    const after = (await scanFiles([file])).length;
    ctx.ui.ok(`✅ Exorcised ${findings.length} ghosts from ${path.basename(file)} ⚡ via ${fixed.provider} (${findings.length + after - after} → ${after} findings)`);
  }));
```

**Wiring:** imports the scanner from sibling `scan.ts` (same app — allowed), agent via `generateValid`, writes via `core/fs-utils`, UI via `ctx.ui`. The git check and esbuild validation are why this command can claim "safe by default."

### 3.6 `commands/spawn.ts` — the skeleton reproduces

```ts
export function registerSpawn(program: Command, ctx: CoreContext): void {
  program.command('spawn').argument('<name>').option('--with-aws').option('--dir <dir>', process.cwd())
    .action(withErrors(async (name: string, opts) => {
      const target = resolveInside(opts.dir, name);              // same traversal guard as everything else
      if (fs.existsSync(target)) throw new SkeletonError(`${name} already exists.`, 'Pick another name.');

      const s = ctx.ui.spin(`🦴 Raising ${name}…`);
      // templates/spawn/ ships with the npm package (tsup `publicDir`), resolved via import.meta.url
      await copyTemplate(templatesDir('spawn'), target, { name });          // package.json, tsconfig, README stub
      await copyCore(target, { aws: opts.withAws });                        // copies core/ MINUS aws.ts unless asked
      safeWrite(target, 'src/commands/example.ts', exampleCommandPack(name)); // shows the register() contract
      s.succeed('Bones assembled');

      await execa('npm', ['install'], { cwd: target });
      ctx.ui.ok(`${name} has risen.`);
      console.log(ctx.ui.dim(`  Next: cd ${name} && npm run dev -- --help`));
    }));
}
```

Key detail: `copyCore` copies the **actual `src/core/` source** (bundled into the published package as a `skeleton/` asset via tsup's copy step) — not a hand-maintained duplicate. The spawned CLI's core is byte-identical to the one that spawned it. That's the proof-of-template, and it's why `core/` must stay self-contained and domain-free.

### 3.7 `commands/doctor.ts` — preflight, works with a broken env

Registered **without** ctx (it must run when nothing else can). Each check returns `{ ok, message, hint? }`; doctor prints ✅/🚫 lines and exits 1 if any hard check fails:

| Check | How | Verdict |
|---|---|---|
| Node ≥ 20 | `process.versions.node` | hard fail |
| `kiro-cli` on PATH + `KIRO_API_KEY` | `which` + env | soft: "kiro provider ready" / hint to fallback |
| `OPENAI_API_KEY` (or `OPENAI_BASE_URL`) | env | soft: fallback ready |
| AWS creds + region | `getAwsClients` in try/catch | soft: "deploy unavailable until `aws configure`" |
| Network to agent/AWS endpoints | HEAD request, 3s timeout | soft |

No provider selection happens; doctor instantiates each provider directly and calls `isAvailable()` — wiring that exercises exactly the same code paths the real boot uses.

---

## 4. Build & Packaging Details

- **`tsup`:** entry `src/index.ts`, format `esm`, target `node20`, `banner: '#!/usr/bin/env node'`, plus a copy step: `src/core → dist/skeleton/core` and `templates/ → dist/templates` (spawn's raw materials must ship as *source*, not bundled).
- **`package.json`:** `"type": "module"`, `"bin": { "bones": "dist/index.js" }`, engines `node >= 20`.
- **Dev loop:** `npm run dev` = `tsx src/index.ts` (no build step while iterating).
- **Import boundary (ESLint):**
  ```js
  'no-restricted-paths': ['error', { zones: [
    { target: './src/commands/lambda', from: './src/commands/a11y' },
    { target: './src/commands/a11y',   from: './src/commands/lambda' },
    { target: './src/core',            from: './src/commands' },
  ]}]
  ```

---

## 5. Testing Strategy (what wires to what, in tests)

| Suite | Scope | Mechanism |
|---|---|---|
| `agent-parse.test.ts` | sentinel extraction, malformed JSON, schema violations, retry nudge | pure unit, no providers |
| `fs-utils.test.ts` | traversal rejection (`../../evil`), atomic write, `.bak` creation | unit, tmp dirs |
| `agent.test.ts` | KiroCliProvider arg construction (no shell string!), OpenAiProvider request shape | mock `execa`/`fetch` |
| `lambda-create.test.ts` | full create flow incl. one self-heal retry | `--mock-agent` fixtures + tmp dir |
| `a11y.test.ts` | scan finds seeded ghosts in `examples/haunted-app/`; fix applies + re-scans clean | mock agent fixture for the fix step |
| smoke (manual) | real `deploy`/`destroy` vs sandbox AWS account; `doctor` on a clean machine | checklist, not CI |

`--mock-agent` is the linchpin: because every command calls the agent only through `generateValid(ctx.agent, …)`, swapping in `MockProvider` at boot makes the entire CLI deterministic under test without touching a single command file.

---

## 6. Cross-Cutting Conventions

- **Output:** commands speak only through `ctx.ui` (never raw `chalk`/`ora`); `--json` swaps in the muted theme at boot.
- **Errors:** throw `SkeletonError(message, hint)` from anywhere; `withErrors` handles presentation. Every error ends with the exact next step.
- **Security:** agent prompts via execa arg arrays; all writes through `safeWrite`; AWS creds stay in the SDK chain; README discloses that `a11y fix` sends file contents to an external AI API.
- **Global flags on every command:** `--json`, `--verbose`, `--agent <provider>`, `--mock-agent`. `--help` text is audited copy — it's part of the UI.


---

## 7. README Required Disclosures (Competition Compliance)

The hackathon rules require explicit disclosure of pre-existing code and third-party integrations. The README must include:

### Pre-Existing Code Disclosure

**Section heading:** "Dependencies & Pre-Existing Work"

**Content:**
> This project was built from scratch during the Kiroween 2026 hackathon (October 30 – December 4, 2026). No project-specific starter templates or boilerplate were used. The following standard development resources power the implementation:
>
> - **TypeScript toolchain:** Node.js 20+, tsup (bundler), tsx (dev runner), vitest (test framework)
> - **CLI framework:** Commander.js (command parsing), ora (spinners), chalk (colors), figures (unicode symbols)
> - **Agent layer:** kiro-cli (headless mode), OpenAI SDK (fallback provider), zod (schema validation)
> - **AWS integration:** AWS SDK v3 (Lambda, S3, IAM clients)
> - **A11y engines:** ESLint + eslint-plugin-jsx-a11y (JSX scanner), parse5 (HTML parser)
> - **Utility libraries:** execa (process spawning), globby (file matching), diff (patch generation), prompts (interactive CLI)
>
> All application logic — the skeleton core, both domain apps, and the spawn command — was authored during the submission period.

### Third-Party Integration Authorization

**Section heading:** "API & Service Integrations"

**Content:**
> This CLI integrates the following third-party services. Users provide their own credentials; no services are called without explicit user authorization:
>
> - **Kiro AI (default):** Requires `KIRO_API_KEY` environment variable. Users must have a Kiro Pro+ account with API access enabled. [Sign up at kiro.dev](https://kiro.dev)
> - **OpenAI (fallback):** Requires `OPENAI_API_KEY` or `OPENAI_BASE_URL` for OpenAI-compatible providers. Users provide their own API key. Opt-in via `--agent openai` flag.
> - **AWS (deploy only):** Lambda deployment requires AWS credentials configured via `aws configure` or `~/.aws/credentials`. Users deploy to their own AWS account; `bones` never accesses AWS resources without explicit command invocation (`lambda deploy`, `lambda destroy`).
>
> **Privacy:** The `a11y fix` command sends file contents to the selected AI provider for code generation. Users must approve all fixes via diff preview before they are written to disk.

### Demo URL

**Section heading:** "Live Demo"

**Content:**
> **Demo application:** [https://<cloudfront-url>](https://<cloudfront-url>)  
> A deliberately accessibility-broken React sample app (the "haunted app") deployed for judges to test `bones a11y scan` without requiring AWS credentials.
>
> **Documentation site:** [https://<docs-url>](https://<docs-url>)  
> Interactive quickstart and architecture walkthrough.

---

## 8. Day 1 Checklist (Oct 30, 2026)

Before writing any application code, ship the skeleton:

- [ ] `git init`, first commit with MIT LICENSE + .gitignore (but NOT `.kiro/`)
- [ ] `.kiro/specs/core.md` — the core module contracts (placeholder; Kiro fills it)
- [ ] `.kiro/steering/style.md` — TypeScript/ESM rules, no `any`, explicit exports
- [ ] `.kiro/steering/imports.md` — "commands import from core only" rule
- [ ] `package.json` with tsup/vitest/commander/chalk/ora/zod/execa
- [ ] `tsconfig.json` — strict mode, ESM, node20 target
- [ ] `src/index.ts` — 8-line entry point
- [ ] `src/core/cli.ts` — boot skeleton (`createProgram()` returns a Commander instance)
- [ ] `src/core/errors.ts` — `SkeletonError` + `withErrors` + `fatal`
- [ ] `src/commands/doctor.ts` — preflight checks (Node, agent providers, AWS creds)
- [ ] `README.md` — title, one-line description, `npm install`, `bones doctor`, disclosure sections
- [ ] `npm run dev -- doctor` passes locally
- [ ] Commit: "Day 1: skeleton standing"

**Nothing domain-specific yet.** No `agent.ts`, no AWS, no a11y. Just the scaffold, error handling, and doctor.


```json
{
  "name": "skeleton",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./components": "./dist/components/index.js",
    "./hooks": "./dist/hooks/index.js",
    "./lib": "./dist/lib/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "react": "^18.3.0",
    "zod": "^3.22.0",
    "diff": "^5.1.0",
    "react-dropzone": "^14.2.0",
    "react-syntax-highlighter": "^15.5.0",
    "react-markdown": "^9.0.0"
  },
  "peerDependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

**Build:** `tsup src/index.ts --format esm --dts` → `dist/` folder. Apps import the built version.

---

## 2. App 1: Lambda Scaffolder (`apps/src/app/lambda/`)

### 2.1 Route structure

```
apps/src/app/
├── page.tsx                # Landing page: links to /lambda and /a11y
├── lambda/
│   └── page.tsx            # Lambda scaffolder UI
├── a11y/
│   └── page.tsx            # A11y auditor UI
└── api/
    ├── agent/
    │   ├── kiro/route.ts   # Server-side Kiro API call
    │   └── openai/route.ts # Server-side OpenAI API call
    └── deploy/route.ts     # AWS Lambda deployment (server-side)
```

### 2.2 `apps/src/app/lambda/page.tsx` — the workflow (fixed)

```tsx
'use client';
import { useState } from 'react';
import { useAgent, SpecEditor, CodePreview } from 'skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function LambdaScaffolder() {
  const agent = useAgent();
  const [prompt, setPrompt] = useState('');
  const [spec, setSpec] = useState('');
  const [code, setCode] = useState<Array<{ path: string; content: string }>>([]);
  const [step, setStep] = useState<'prompt' | 'spec' | 'code'>('prompt');
  const [loading, setLoading] = useState(false);

  const handleGenerateSpec = async () => {
    setLoading(true);
    try {
      const result = await agent.generate({
        task: `Write a detailed spec for a Lambda function that: ${prompt}. Return ONLY the spec as markdown.`,
        outputSchema: 'code',
      });
      setSpec(result.code);
      setStep('spec');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      const result = await agent.generate({
        task: 'Implement this Lambda function spec. Return handler.js, package.json, and README.md.',
        context: spec,
        outputSchema: 'files',
      });
      setCode(result.files);
      setStep('code');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    code.forEach((f) => zip.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'lambda-function.zip');
  };

  const handleDeploy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: code, functionName: 'skeleton-lambda' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { arn } = await res.json();
      alert(`Deployed: ${arn}`);
    } catch (err) {
      alert(`Deploy failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!agent.ready) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">⚡ Lambda Scaffolder</h1>
      
      {step === 'prompt' && (
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your Lambda function..."
            className="w-full h-32 p-4 border rounded"
          />
          <button onClick={handleGenerateSpec} disabled={loading || !prompt} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Spec'}
          </button>
        </div>
      )}

      {step === 'spec' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Spec (edit as needed)</h2>
          <SpecEditor initialValue={spec} onChange={setSpec} />
          <button onClick={handleGenerateCode} disabled={loading} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Code'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Generated Code</h2>
          <div className="mb-4 text-sm text-gray-600">⚡ Generated with {agent.provider}</div>
          {code.map((file) => (
            <div key={file.path} className="mb-4">
              <h3 className="font-mono text-sm mb-2">{file.path}</h3>
              <CodePreview after={file.content} language="typescript" />
            </div>
          ))}
          <button onClick={handleDownloadZip} className="mt-4 px-6 py-2 bg-green-600 text-white rounded">
            Download ZIP
          </button>
          <button onClick={handleDeploy} disabled={loading} className="mt-4 ml-4 px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Deploying...' : 'Deploy to AWS'}
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2.3 `apps/src/app/api/agent/status/route.ts` — provider status

```ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    kiro: !!process.env.KIRO_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  });
}
```

### 2.4 `apps/src/app/api/agent/kiro/route.ts` — server-side Kiro (if available)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { FilesSchema, CodeSchema, ReportSchema } from 'skeleton/lib/agent';

export const maxDuration = 60; // Allow longer LLM calls

export async function POST(req: NextRequest) {
  const { task, context, outputSchema } = await req.json();
  const apiKey = process.env.KIRO_API_KEY;
  if (!apiKey) return new Response('KIRO_API_KEY not set', { status: 500 });

  // TODO: Replace with actual Kiro headless endpoint once documented
  // For now, this is a placeholder that will be verified during Day 1 spike
  // If Kiro has no headless API, remove this file and use OpenAI as default
  
  const prompt = buildPrompt(task, context, outputSchema);
  
  // Placeholder: assumes OpenAI-compatible endpoint
  const res = await fetch('https://api.kiro.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(`Kiro API error: ${error}`, { status: res.status });
  }

  const data = await res.json();
  const output = data.choices[0].message.content;
  
  // Validate and return typed JSON
  const schema = { files: FilesSchema, code: CodeSchema, report: ReportSchema }[outputSchema];
  const validated = schema.parse(JSON.parse(output));
  
  return NextResponse.json({ ...validated, provider: 'kiro' });
}

function buildPrompt(task: string, context: string | undefined, schema: string): string {
  const schemaInstructions = {
    files: 'Return JSON: { files: [{ path: string, content: string }], explanation: string }',
    code: 'Return JSON: { code: string, explanation: string }',
    report: 'Return JSON: { report: string, explanation: string }',
  }[schema];

  return `${task}\n\n${context ?? ''}\n\n${schemaInstructions}. Return ONLY valid JSON, no markdown.`;
}
```

### 2.5 `apps/src/app/api/agent/openai/route.ts` — server-side OpenAI

```ts
import { NextRequest, NextResponse } from 'next/server';
import { FilesSchema, CodeSchema, ReportSchema } from 'skeleton/lib/agent';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { task, context, outputSchema } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OPENAI_API_KEY not set', { status: 500 });

  const prompt = buildPrompt(task, context, outputSchema);
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(`OpenAI API error: ${error}`, { status: res.status });
  }

  const data = await res.json();
  const output = data.choices[0].message.content;
  
  // Validate with retry
  const schema = { files: FilesSchema, code: CodeSchema, report: ReportSchema }[outputSchema];
  try {
    const validated = schema.parse(JSON.parse(output));
    return NextResponse.json({ ...validated, provider: 'openai' });
  } catch (err) {
    // One-shot self-heal retry
    const retryPrompt = `${prompt}\n\nYour previous output failed validation: ${(err as Error).message}. Return ONLY valid JSON.`;
    const retryRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: retryPrompt }],
        response_format: { type: 'json_object' },
      }),
    });
    
    const retryData = await retryRes.json();
    const retryOutput = retryData.choices[0].message.content;
    const validated = schema.parse(JSON.parse(retryOutput));
    return NextResponse.json({ ...validated, provider: 'openai' });
  }
}

function buildPrompt(task: string, context: string | undefined, schema: string): string {
  const schemaInstructions = {
    files: 'Return JSON: { files: [{ path: string, content: string }], explanation: string }',
    code: 'Return JSON: { code: string, explanation: string }',
    report: 'Return JSON: { report: string, explanation: string }',
  }[schema];

  return `${task}\n\n${context ?? ''}\n\n${schemaInstructions}`;
}
```

### 2.4 `apps/src/app/api/deploy/route.ts` — AWS Lambda deploy

```ts
import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';
import { NextRequest } from 'next/server';
import AdmZip from 'adm-zip';

export async function POST(req: NextRequest) {
  const { files, functionName } = await req.json();
  
  // Build ZIP in memory
  const zip = new AdmZip();
  files.forEach((f: { path: string; content: string }) => {
    zip.addFile(f.path, Buffer.from(f.content));
  });

  const lambda = new LambdaClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  
  try {
    await lambda.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs20.x',
      Handler: 'handler.handler',
      Role: process.env.AWS_LAMBDA_ROLE_ARN,
      Code: { ZipFile: zip.toBuffer() },
    }));
  } catch (err) {
    if ((err as Error).name === 'ResourceConflictException') {
      await lambda.send(new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zip.toBuffer(),
      }));
    } else {
      throw err;
    }
  }

  return new Response(JSON.stringify({ arn: `arn:aws:lambda:us-east-1:...:function:${functionName}` }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## 3. App 2: A11y Auditor (`apps/src/app/a11y/`)

### 3.1 Route structure

```
apps/src/app/
├── a11y/
│   └── page.tsx            # A11y auditor UI
└── api/
    ├── scan/route.ts       # Server-side ESLint + parse5
    ├── fix/route.ts        # Agent fixes files
    └── agent/...           # Same as lambda (shared)
```

### 3.2 `apps/src/app/a11y/page.tsx` — the workflow (fixed)

```tsx
'use client';
import { useState } from 'react';
import { FileUpload, CodePreview, useAgent } from 'skeleton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Finding {
  file: string;
  line: number;
  col: number;
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
}

const EXAMPLE_FILES = [
  { name: 'App.tsx', content: '<img src="logo.png" />\n<button onClick={handleClick}>Click</button>' },
];

export default function A11yAuditor() {
  const agent = useAgent();
  const [files, setFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fixed, setFixed] = useState<Array<{ path: string; before: string; after: string }>>([]);
  const [loading, setLoading] = useState(false);

  const loadExample = () => {
    setFiles(EXAMPLE_FILES);
    setFindings([]);
    setFixed([]);
  };

  const handleScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const data = await res.json();
      setFindings(data.findings);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async (file: string) => {
    setLoading(true);
    try {
      const fileContent = files.find((f) => f.name === file)?.content;
      const fileFindings = findings.filter((f) => f.file === file);
      
      const result = await agent.generate({
        task: `Fix these accessibility issues. Make MINIMAL changes. Do NOT alter any logic or styling. Return ONLY the fixed code.`,
        context: `File: ${file}\n\n${fileContent}\n\nIssues to fix:\n${fileFindings.map((f) => `- Line ${f.line}: ${f.ruleId} - ${f.message}`).join('\n')}`,
        outputSchema: 'code',
      });
      
      // Basic parse check: must be valid JSX/TSX
      if (!result.code.includes('export') && !result.code.includes('function')) {
        throw new Error('Generated code does not look like a React component');
      }
      
      setFixed((prev) => [...prev, { path: file, before: fileContent!, after: result.code }]);
    } catch (err) {
      alert(`Fix failed: ${(err as Error).message}`);
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

  if (!agent.ready) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">🕸️ A11y Auditor</h1>

      {files.length === 0 && (
        <div>
          <FileUpload
            accept={{ 'text/*': ['.jsx', '.tsx', '.html'] }}
            maxSize={1 * 1024 * 1024}  // 1MB limit (below Vercel's 4.5MB)
            onFiles={setFiles}
          />
          <button onClick={loadExample} className="mt-4 px-6 py-2 bg-gray-600 text-white rounded">
            Load Example
          </button>
        </div>
      )}

      {files.length > 0 && findings.length === 0 && (
        <button onClick={handleScan} disabled={loading} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
          {loading ? 'Scanning...' : 'Scan for Issues'}
        </button>
      )}

      {findings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Findings ({findings.length})</h2>
          {findings.map((f, i) => (
            <div key={i} className={`border-l-4 ${f.severity === 'error' ? 'border-red-500' : 'border-yellow-500'} pl-4 mb-4`}>
              <div className="font-mono text-sm">{f.file}:{f.line}:{f.col}</div>
              <div className={f.severity === 'error' ? 'text-red-600' : 'text-yellow-600'}>{f.ruleId}</div>
              <div>{f.message}</div>
              <button onClick={() => handleFix(f.file)} disabled={loading} className="mt-2 text-purple-600 underline disabled:opacity-50">
                {loading ? 'Fixing...' : 'Fix'}
              </button>
            </div>
          ))}
        </div>
      )}

      {fixed.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Fixed Files</h2>
          <div className="mb-4 text-sm text-gray-600">⚡ Generated with {agent.provider}</div>
          {fixed.map((f) => (
            <div key={f.path} className="mb-8">
              <h3 className="font-mono text-sm mb-2">{f.path}</h3>
              <CodePreview before={f.before} after={f.after} language="tsx" showDiff />
            </div>
          ))}
          <button onClick={handleDownloadFixed} className="px-6 py-2 bg-green-600 text-white rounded">
            Download Fixed Files
          </button>
        </div>
      )}
    </div>
  );
}
```

### 3.3 `apps/src/app/api/scan/route.ts` — server-side scan (fixed)

```ts
import { ESLint } from 'eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { files } = await req.json();
  
  const eslint = new ESLint({
    overrideConfigFile: true,
    baseConfig: {
      plugins: { 'jsx-a11y': jsxA11y },
      rules: Object.fromEntries(
        Object.keys(jsxA11y.configs.recommended.rules ?? {}).map((r) => [r, 'error'])
      ),
      languageOptions: {
        parser: require('@typescript-eslint/parser'),
        parserOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
        },
      },
    },
  });

  const findings = [];
  for (const file of files) {
    const results = await eslint.lintText(file.content, { filePath: file.name });
    findings.push(...results.flatMap((r) => r.messages.map((m) => ({
      file: r.filePath,
      line: m.line,
      col: m.column,
      ruleId: m.ruleId ?? 'unknown',
      severity: m.severity === 2 ? 'error' : 'warning' as const,
      message: m.message,
    }))));
  }

  return NextResponse.json({ findings });
}
```

---

## 4. Landing Page & Clone Feature

### 4.1 `apps/src/app/layout.tsx` — root layout with AgentProvider

```tsx
import { AgentProvider } from 'skeleton';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AgentProvider>
          {children}
        </AgentProvider>
      </body>
    </html>
  );
}
```

### 4.2 `apps/src/app/page.tsx` — home (server component, fixed)

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">🦴 Skeleton</h1>
      <p className="text-xl mb-8">One component library. Two web apps.</p>
      
      <div className="grid grid-cols-2 gap-8 mb-8">
        <Link href="/lambda" className="p-8 border rounded hover:border-purple-500 block">
          <h2 className="text-2xl font-bold mb-2">⚡ Lambda Scaffolder</h2>
          <p>Prompt → spec → code → deploy</p>
        </Link>
        <Link href="/a11y" className="p-8 border rounded hover:border-purple-500 block">
          <h2 className="text-2xl font-bold mb-2">🕸️ A11y Auditor</h2>
          <p>Scan → fix → download</p>
        </Link>
      </div>

      <a href="/api/clone" download="skeleton-starter.zip" className="inline-block px-8 py-3 bg-purple-600 text-white rounded">
        Clone This Skeleton
      </a>
    </div>
  );
}
```

### 4.3 `apps/src/app/api/clone/route.ts` — download skeleton starter

```ts
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  // Pre-built ZIP at build time (see next.config.js script)
  const zipPath = path.join(process.cwd(), 'public', 'skeleton-starter.zip');
  
  if (!fs.existsSync(zipPath)) {
    return new Response('Skeleton starter not found. Run build script first.', { status: 500 });
  }

  const buffer = fs.readFileSync(zipPath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=skeleton-starter.zip',
    },
  });
}
```

**Build script** (add to `apps/package.json`):

```json
{
  "scripts": {
    "prebuild": "node scripts/build-skeleton-zip.js",
    "build": "next build"
  }
}
```

**`apps/scripts/build-skeleton-zip.js`:**

```js
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const output = fs.createWriteStream(path.join(__dirname, '../public/skeleton-starter.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

archive.pipe(output);

// Add skeleton/ source
archive.directory(path.join(__dirname, '../../skeleton/src'), 'skeleton/src');
archive.file(path.join(__dirname, '../../skeleton/package.json'), { name: 'skeleton/package.json' });
archive.file(path.join(__dirname, '../../skeleton/tsconfig.json'), { name: 'skeleton/tsconfig.json' });

// Add Next.js starter template
archive.append(`{
  "name": "my-skeleton-app",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "skeleton": "file:../skeleton"
  }
}`, { name: 'app/package.json' });

archive.append(`# Skeleton Starter\n\nRun:\n\`\`\`\ncd skeleton && npm install && npm run build\ncd ../app && npm install && npm run dev\n\`\`\``, { name: 'README.md' });

archive.finalize();
```

Replace CLI `spawn` with this download. Shows the skeleton is reusable without running a command.

## 5. Build & Deploy

- **Skeleton:** `cd skeleton && npm run build` → `dist/` folder
- **App:** `cd apps && npm install && npm run build` → one Vercel deployment
- **Routes:**
  - `/` → landing page
  - `/lambda` → App 1
  - `/a11y` → App 2

**Environment variables (Vercel):**
- `KIRO_API_KEY` (server-only, no NEXT_PUBLIC_)
- `OPENAI_API_KEY` (server-only, no NEXT_PUBLIC_)
- `AWS_LAMBDA_ROLE_ARN`
- `AWS_REGION`

**Day 1 spike:** Verify Kiro headless endpoint exists. If not: use OpenAI as default, keep Kiro as build-process evidence (specs/steering). Don't fake the "Generated with Kiro" badge.

One URL. Judges can use both apps without installing Node.

---

## 6. Testing Strategy

| Suite | Scope | Mechanism |
|---|---|---|
| `skeleton/src/lib/agent.test.ts` | Schema validation, error handling | Vitest, mocked fetch |
| `apps/src/app/api/scan/route.test.ts` | ESLint integration, finding shape | Vitest, sample fixtures |
| `apps/src/app/api/agent/openai/route.test.ts` | Prompt shape, retry logic | Vitest, mocked OpenAI responses |
| `apps/src/components/*.test.tsx` | Component rendering, user interactions | Vitest + React Testing Library |
| `e2e/lambda.spec.ts` | Full Lambda workflow | Playwright, mocked agent responses |
| `e2e/a11y.spec.ts` | Full a11y workflow | Playwright, pre-seeded files |
| `e2e/axe.spec.ts` | Accessibility of our own site | Playwright + axe-core |

**Mock/demo mode:** Add `DEMO_MODE=true` env var. API routes return cached fixtures instead of calling live APIs. Lets the public URL work without secrets until judging.

---

## 7. Day 1 Checklist (Oct 30, 2026)

- [ ] **Spike Kiro headless API:** Discord or docs. Get real endpoint, auth, request/response shape. If none exists, switch default to OpenAI.
- [ ] Create two folders: `skeleton/`, `apps/`
- [ ] `skeleton/package.json` + tsconfig (react as peer/dev, not direct dep)
- [ ] `skeleton/src/index.ts` exports `AgentProvider`, `useAgent`, `FileUpload`, `CodePreview`, `SpecEditor`
- [ ] `apps/package.json` with `"skeleton": "file:../skeleton"`
- [ ] `apps/src/app/layout.tsx` (mounts AgentProvider)
- [ ] `apps/src/app/page.tsx` (landing page, server component)
- [ ] `apps/src/app/lambda/page.tsx` (empty stub)
- [ ] `apps/src/app/a11y/page.tsx` (empty stub)
- [ ] `apps/.eslintrc.js` (no-restricted-imports with @typescript-eslint/parser)
- [ ] `apps/scripts/build-skeleton-zip.js` + `prebuild` hook
- [ ] `.kiro/specs/skeleton.md` — component contracts
- [ ] `.kiro/steering/boundaries.md` — apps import from skeleton only, enforced by ESLint
- [ ] `README.md` — structure, two-apps justification, setup, disclosure sections
- [ ] Commit: "Day 1: skeleton + two route apps + verified Kiro endpoint"
