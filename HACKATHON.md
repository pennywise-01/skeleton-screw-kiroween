# 🎃 Kiroween 2026 — Competition Strategy & Submission Meta

> This file covers everything *about* the competition: eligibility, rules validation, Kiro-as-judging-criterion strategy, timeline, video, and submission checklist.
> **Implementation details live in [PLAN.md](./PLAN.md).**
>
> **Architecture (Oct 30):** Web app. One React component library (skeleton), two Next.js apps using it.

---

## 1. Category & Concept

**Category:** Skeleton Crew — *"Build a skeleton code template lean enough to be clear but flexible enough to support various use cases. Show us its versatility with two distinct applications from your foundation."*

**Concept:** A lean React component library (agent interface, file upload, code preview, spec editor) with two domain apps that share 100% of the skeleton and 0% of their domain logic:
- **App 1 — Lambda Scaffolder:** prompt → spec → tested code → deploy to AWS Lambda.
- **App 2 — A11y Auditor:** upload files → static-analysis scan → AI-generated fixes with diff preview.
- **The closer — "Clone Skeleton":** Download button that gives you the component library + empty Next.js shell. Proves reusability without running a command.

**⚠️ Eligibility constraint:** No source code before **October 30, 2026** (submissions open). Planning only until then. Deadline: **December 4, 2026, 2:00 PM PT**.

---

## 2. Validation Against Competition Requirements

Official 2026 rules (posted Oct 30) — full compliance table:

| Requirement | Status | Implementation |
|---|---|---|
| **Functional on intended platform** | ✅ | Web app runs on any modern browser. Works without install. |
| **URL to functional application** | ✅ | One deployed site with `/lambda` and `/a11y` routes. |
| **Text description on Devpost** | ✅ | 3–4 paragraph pitch below (§8). |
| **New project, built during submission period** | ✅ | Repo created Oct 30, 2026. No code before that date. |
| **Disclose pre-existing code/templates** | ✅ | README section: "Built on Next.js, React, zod, AWS SDK v3, ESLint — all standard libraries. No project-specific starter templates used." |
| **Third-party SDK/API authorization** | ✅ | Devpost + README: Kiro (user provides API key), AWS (user's account), OpenAI (optional fallback, user's key). |
| **Two distinct applications** | ✅ | `/lambda` and `/a11y` are separate routes with their own page components, domain logic (AWS vs ESLint), and enforced ESLint boundaries. |
| **Kiro usage is a judged criterion** | ✅ | `.kiro/specs`, `.kiro/steering`, `.kiro/hooks` committed. Runtime uses Kiro API (if available after Day 1 spike). |
| Public repo + OSI license | ✅ | MIT `LICENSE` on Day 1. |
| Demo video ≤ 3 minutes | ✅ | Pre-recorded with screen capture. |
| Register with Kiro user ID, join Discord | ✅ | Done pre-event. |

**Verdict: core plan fits all requirements. Day 1 spike will verify Kiro headless API exists; if not, OpenAI becomes default and Kiro stays as build-process evidence.**

---

## 3. The Kiro Integration Story (judging criterion)

Two layers — do both:

**Layer 1: Kiro built the project (process evidence, committed to `/.kiro`):**
- `.kiro/specs/` — real specs written in Kiro before each phase; Kiro implements against them.
- `.kiro/steering/` — React/TypeScript style, ESM rules, theming guidelines, "apps import from skeleton only" rule.
- `.kiro/hooks/` — e.g., run tests on save; regenerate README component count badge.

**Layer 2: Kiro powers the product (runtime evidence, if available):**
- **Day 1 spike required:** Verify Kiro headless endpoint exists. Ask on Discord or check docs for the real API URL, auth method, and request/response shape.
- If yes: Server-side API routes (`/api/agent/kiro`) call Kiro's headless endpoint with `KIRO_API_KEY`. UI shows "⚡ Generated with Kiro."
- If no: Use OpenAI as default runtime provider. Keep Kiro as build-process evidence (the `.kiro/` dir is still committed and judged). Don't fake the badge.

**Multi-provider design is still a feature:** `checkProviders()` auto-selects the first available API (Kiro or OpenAI). Judges without Kiro Pro can use OpenAI keys.

Video line: *"Kiro specced and built the skeleton"* + *(if runtime works)* *"— and the skeleton runs on Kiro."*

---

## 4. Timeline (calendar-mapped)

| Dates | Phase |
|---|---|
| **Oct 30** | Rules drop → re-validate §2. **Spike Kiro headless API** (Discord / docs). `git init`, MIT LICENSE, `.kiro/` skeleton, two folders (`skeleton/`, `apps/`), component stubs, ESLint boundary. **Day 1 ends with the skeleton standing + verified API or OpenAI default decision.** |
| **Oct 31 – Nov 2** | Skeleton: `AgentProvider`, `useAgent`, `FileUpload`, `CodePreview`, `SpecEditor`. Unit tests for agent parsing + auto-fallback. |
| **Nov 3 – Nov 5** | Lambda app complete: prompt → spec (editable) → code → deploy API route. Test against a real AWS sandbox account. |
| **Nov 6 – Nov 8** | A11y app complete: scan + fix on example files. Pass full findings (line/message) to agent. Download fixed files. |
| **Nov 9 – Nov 10** | `/api/clone` ZIP generation + landing page polish. Build-time script zips skeleton/. README quickstart verified on a clean machine/VM. |
| **Nov 11 – Nov 17** | **Polish week:** record video, README diagrams, example outputs, error-message audit. Buffer for AWS/ESM gremlins. Deploy to Vercel. Add DEMO_MODE for public URL without secrets. |
| **Nov 18 – Dec 1** | Contingency + stretch goals. Get 2–3 people from Kiro Discord to test the live app cold; fix everything they trip on. Run axe on your own site. |
| **Dec 2 – Dec 4** | Submit on Devpost well before the Dec 4, 2:00 PM PT deadline. No code changes on the final day. |

---

## 5. Demo Video Script (≤ 3:00)

Pre-record everything with screen capture + edited cuts. Never demo AI + AWS live.

- **0:00–0:20** — Hook: "One skeleton. Two web apps. Watch it clone itself." Show `skeleton.vercel.app` home page → click through to both apps.
- **0:20–1:10** — App 1 (`/lambda`): Type prompt → spec appears → code generates → download ZIP → click "Deploy to AWS" → live Lambda URL.
- **1:10–2:00** — App 2 (`/a11y`): Upload haunted React files → scan results → click "Fix" on one issue → diff preview → download fixed files.
- **2:00–2:35** — The closer: Back to home page → click "Clone Skeleton" button → ZIP downloads → unzip and show the empty Next.js shell + skeleton import.
- **2:35–3:00** — Kiro layer: flash `.kiro/specs` + steering, the "⚡ Generated with Kiro" UI badge, one-line outro.

---

## 6. Submission Checklist (re-check against official rules Oct 30)

- [ ] Official 2026 rules re-read; this doc re-validated
- [ ] Registered with Kiro user ID
- [ ] Public GitHub repo, created no earlier than Oct 30
- [ ] MIT LICENSE at root
- [ ] `/.kiro` committed (specs, steering, hooks), NOT in `.gitignore`
- [ ] **URL to functional application** — one deployed site with both apps as routes
- [ ] README: < 5-min quickstart, architecture diagram, category statement, component count badge
- [ ] README: **Pre-existing code disclosure** — list frameworks, libraries, starter templates
- [ ] README: **Third-party authorization** — Kiro, AWS, OpenAI (user provides keys)
- [ ] Demo video ≤ 3:00, shows both apps working + Kiro usage
- [ ] Devpost text description (3–4 paragraphs): category = Skeleton Crew, features, Kiro integration
- [ ] Both apps tested on a clean machine (or by a friend)
- [ ] Live site tested: both routes work, example data loads

---

## 7. Demo URL Strategy (new requirement)

Judges need a URL to a functional application. Deploy as one Next.js app with two routes:

**URL:** `https://skeleton.vercel.app` (or custom domain)

| Route | What judges can do |
|---|---|
| `/lambda` | Type a prompt, see spec + code generation, download ZIP (AWS deploy requires their own credentials) |
| `/a11y` | Upload JSX/HTML files, see scan results, click "Fix", download patched files |
| `/` (home) | Landing page with links to both apps + "Clone Skeleton" download button |

**Structure:**
```
app/
├── page.tsx              # Landing page
├── lambda/
│   └── page.tsx          # App 1
├── a11y/
│   └── page.tsx          # App 2
└── api/
    ├── agent/...         # Shared API routes
    └── deploy/...
```

**Environment variables for deployment:**
- `KIRO_API_KEY` (server-only, verified on Day 1)
- `OPENAI_API_KEY` (server-only fallback)
- `AWS_LAMBDA_ROLE_ARN` (for deploy API route)

**Demo data:** Pre-seed the a11y app with a "Load Example" button that fills in the haunted React sample, so judges don't have to find their own files.

This satisfies "URL to your functional application(s)" with one deployed site showing both apps.

---

## 8. Devpost Text Description

> **Skeleton** is a ~500-line React component library that ships with zero opinions about what it automates. From that one skeleton: **a Lambda scaffolder** that turns a sentence into a specced, tested, deployable function, and **an accessibility auditor** that finds a11y violations with real static analysis and fixes them with AI-generated, diff-previewed patches. Then, to prove the skeleton isn't just shared code but a true template, a "Clone Skeleton" button downloads the component library + an empty Next.js shell — live reusability.
>
> **Kiro integration:** The project was built with Kiro specs, steering files, and hooks (committed in `.kiro/`). At runtime, both apps use Kiro's API as their default AI provider (if the headless endpoint is available), with OpenAI fallback for users without Kiro Pro.
>
> **Why Skeleton Crew:** One component library (`skeleton/`), two distinct Next.js route applications (`/lambda` and `/a11y`), enforced by ESLint to prevent cross-imports. The Lambda app handles AWS deployments; the a11y app runs ESLint scans. No shared domain logic. The "Clone Skeleton" feature proves the skeleton is a true template — not just shared utilities.
>
> **Third-party integrations:** Kiro (user provides `KIRO_API_KEY`), AWS (user's account for Lambda deploy), OpenAI (optional fallback). No external services are called without user-provided credentials.

---

## 9. Risks & Stretch Goals

| Risk | Mitigation |
|---|---|
| **Kiro headless API doesn't exist** | Day 1 spike confirms; if not available, use OpenAI as default and keep Kiro as build evidence |
| Judges lack API keys | DEMO_MODE with cached fixtures; live site works without secrets until judging |
| AI latency kills demo | Pre-recorded video; "Load Example" button in a11y app skips upload step |
| Judges lack AWS accounts | Lambda deploy is opt-in; download ZIP works without AWS |
| Rules differ from 2025 | §2 re-validation task scheduled Oct 30, before any code |
| Vercel deploy downtime | Include static screenshots in README; video shows the apps working |
| Scope creep (extra apps, mobile) | Two apps only; resist adding more |
| Demo URL down at judging time | Static export fallback; video proof; GitHub Pages backup |

**Stretch goals (only after video is done):** Real-time collaboration in the spec editor (multiplayer mode); GitHub Action that comments a11y findings on PRs; MCP server exposing the skeleton's components to Kiro itself; mobile-responsive UI.

---

## 8. One-Paragraph Pitch (for Devpost)

> **Skeleton Crew** (`bones`) is a ~600-line TypeScript CLI core — agent interface, AWS layer, safe file I/O, themed UI — that ships with zero opinions about what it automates. From that one skeleton: **an AWS serverless scaffolder** that turns a sentence into a specced, tested, deployed Lambda, and **an accessibility auditor** that finds a11y violations with real static analysis and exorcises them with AI-generated, diff-previewed fixes. Then, to prove the skeleton isn't just shared code but a true template, `bones spawn` scaffolds an entirely new CLI from it — live. Built with Kiro specs, steering, and hooks; powered at runtime by Kiro CLI headless mode.
