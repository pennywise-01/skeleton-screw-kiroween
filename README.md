# 🦴 Skeleton

**One reusable React component library. Two haunted apps built on it. All AI powered by Kiro CLI at runtime.**

Built for the Kiroween hackathon (Skeleton Crew category). The idea: prove one lean skeleton can power two completely unrelated products -- and that Kiro CLI works as a production AI backend, not just a dev tool.

**Live demo:** http://18.143.74.194:3000 (real Kiro CLI, no demo fixtures)

## The Two Apps

### ⚡ Lambda Scaffolder (`/lambda`)

Turn one sentence into a deployable AWS Lambda function.

1. **Prompt** -- describe your function, or click a starter prompt (Node.js and Python examples included).
2. **Spec** -- Kiro writes a full markdown spec. Edit it, preview it, or split the view side by side.
3. **Code** -- Kiro generates the handler, tests, package manifest and README. Copy or download per file, or grab everything as a ZIP with the exact runtime and handler to pick in the AWS Console.

Step pills show where you are and let you jump back without losing generated work.

### 🕸️ A11y Auditor (`/a11y`)

Drop in code, get an AI accessibility audit and AI-written fixes.

1. **Upload** -- drop individual files or a whole ZIP (extracted in your browser). Try the haunted example if you have nothing handy.
2. **Audit** -- Kiro CLI reads every file and reports WCAG violations in any language or framework: line, column, rule, and why it matters. No hardcoded rule sets.
3. **Exorcise** -- fix one file or Fix All. The ghost counter drops to zero, then re-scan to prove the fixes hold.

Findings are grouped per file, fixes show as a syntax-highlighted diff, and you can view the final clean code before downloading.

## The Shared Skeleton

Both apps are built from the same 6 primitives in `skeleton/`, with zero domain code shared:

| Component | What it does | Used by |
|---|---|---|
| `AgentProvider` | Kiro CLI status, health checks, streaming agent calls | Both |
| `SpecEditor` | Markdown editor with Edit / Split / Preview tabs | Lambda |
| `CodePreview` | Syntax-highlighted code and diff view (Diff / Final / Before tabs, copy, line numbers) | Both |
| `FileUpload` | Drag-and-drop upload with ZIP extraction and rejection messages | A11y |
| `SpookyLoader` | Progress bar with live elapsed time and honest estimates | Both |
| `InfoModal` | Instruction dialog with focus trap and session dismissal | Both |

ESLint `no-restricted-imports` rules enforce the boundary -- neither app can import from the other.

## How to Run It

```bash
cd skeleton && npm install && npm run build
cd ../apps && npm install && npm run dev
```

Open http://localhost:3000 -- the landing page links both apps.

**AI provider:** the app shells out to an authenticated `kiro-cli` on the machine (`kiro-cli chat --no-interactive`). No API keys anywhere. Log in once with `kiro-cli login` and both apps work.

**Production:**

```bash
cd apps && npm run build && npm start
```

## Tests

```bash
cd skeleton && npm test        # unit: schemas, agent client
cd apps && npm test            # unit: scan route
cd apps && npm run test:e2e    # Playwright: both workflows + axe-core on our own pages
cd apps && npm run lint        # boundary rules
```

17 unit tests + 6 e2e tests, all green. The axe-core checks audit the app's own pages in populated states -- an accessibility tool that fails WCAG itself would be embarrassing.

## Demo Mode

Set `DEMO_MODE=true` in `apps/.env.local` to make every AI call return cached fixtures. Useful for trying the UI with zero setup; the e2e suite runs entirely in demo mode.

| Variable | Used by | Required |
|---|---|---|
| `DEMO_MODE` | all API routes | No (fixtures when `true`) |

## Built With

- **AI runtime:** [kiro-cli](https://kiro.dev) headless chat -- every audit, spec, codegen and fix call
- **Framework:** Next.js 14 (App Router), React 18, Tailwind CSS
- **Skeleton:** react-dropzone, react-syntax-highlighter, react-markdown + remark-gfm, diff, zod, tsup
- **Packaging:** JSZip + file-saver (client-side ZIP downloads)
- **Testing:** Vitest, Playwright, axe-core
- **Deployment:** AWS EC2 (t3.micro, Amazon Linux 2023), kiro-cli authenticated via Google device flow

Built from scratch during the hackathon -- no starter templates or pre-existing project code.

## License

MIT
