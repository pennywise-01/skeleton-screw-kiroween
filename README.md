# 🦴 Skeleton

One reusable React component library. Two distinct web apps built on it.

- **`skeleton/`** — the component library: `AgentProvider` (AI provider switching), `FileUpload`, `CodePreview` (diff view), `SpecEditor`, plus a transport-agnostic agent client with zod validation.
- **`apps/`** — one Next.js app hosting two route-separated applications:
  - **`/lambda`** — Lambda Scaffolder: prompt → spec → code → download ZIP → deploy manually (runtime + handler guidance shown).
  - **`/a11y`** — A11y Auditor: upload → AI audit (Kiro CLI reads every file) → AI fix → diff preview → download.

The two apps share the skeleton but no domain code. ESLint `no-restricted-imports` rules enforce the boundary.

## Setup

```bash
cd skeleton && npm install && npm run build
cd ../apps && npm install && npm run dev
```

Open http://localhost:3000 — the landing page links both apps.

## Tests

```bash
cd skeleton && npm test        # unit: schemas, agent client
cd apps && npm test            # unit: scan route (ESLint integration)
cd apps && npm run test:e2e    # Playwright: both workflows + axe on our own pages
cd apps && npm run lint        # boundary rules
cd apps && npm run build       # production build (also builds the starter ZIP)
```

## Demo Mode

Set `DEMO_MODE=true` in `apps/.env.local` to make every AI and AWS call return cached fixtures. The public demo works with zero secrets; the e2e suite runs entirely in demo mode.

## Environment Variables

| Variable | Used by | Required |
|---|---|---|
| `DEMO_MODE` | all API routes | No (fixtures when `true`) |

The app shells out to an authenticated `kiro-cli` on the machine — no API keys needed anywhere.

## Dependencies & Pre-Existing Work

This project was built from scratch during the Kiroween hackathon. No project-specific starter templates or boilerplate were used. The following standard development resources power the implementation:

- **Framework:** Next.js 14 (App Router), React 18, Tailwind CSS
- **Component library:** react-dropzone (uploads), react-syntax-highlighter (code/diff view), react-markdown (spec preview), diff (patch generation), zod (schema validation)
- **Agent layer:** kiro-cli (headless chat)
- **A11y engine:** kiro-cli (AI audit, no hardcoded rules)
- **Packaging:** JSZip (client-side ZIP downloads)
- **Testing:** Vitest, Playwright, axe-core
- **Build:** tsup (skeleton), archiver (starter ZIP)

All application logic — the skeleton library, both apps, and the API routes — was authored during the submission period.

## API & Service Integrations

This project integrates the following third-party services. Users provide their own credentials; no service is called without explicit user action:

- **Kiro AI:** Uses the locally installed, already-authenticated `kiro-cli`. No API key is stored or transmitted by this app.

The app never calls AWS. The Lambda app produces a ZIP; the user deploys it from their own AWS Console or CLI.

**Privacy:** The a11y audit and fix features send file contents to Kiro AI via the local `kiro-cli`. Fixes are shown as a diff preview before download; nothing is written back to the user's files by the server.

## Live Demo

> **Demo application:** https://\<deployed-url\>
> Runs with `DEMO_MODE=true` so judges can exercise both apps without any credentials.
