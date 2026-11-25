# Hard Blockers Fixed

All hard blockers from the feedback have been addressed in PLAN.md and HACKATHON.md:

## ✅ Architecture decided
- **One Next.js app with two routes** (`/lambda`, `/a11y`)
- Separate folders under `apps/src/app/` for each route
- Justification: Physical separation + domain separation + independent operation
- ESLint enforces boundaries: no cross-imports between apps
- Configuration in `apps/.eslintrc.js` with `@typescript-eslint/parser`

## ✅ Secret leak fixed
- Changed from `NEXT_PUBLIC_*` to server-only env vars
- `KIRO_API_KEY` and `OPENAI_API_KEY` stay on the server
- Added `/api/agent/status` route that returns `{ kiro: bool, openai: bool }`
- Client calls server routes, never exposes keys

## ✅ Kiro runtime verified
- **Day 1 spike required** (added to checklist and timeline)
- If Kiro headless API doesn't exist: OpenAI becomes default
- Kiro stays as build-process evidence (`.kiro/` dir committed)
- Don't fake the "Generated with Kiro" badge if API unavailable
- Multi-provider auto-fallback still works

## ✅ Core demo CTAs specified
- `/api/clone` route returns pre-built ZIP from `public/`
- Build script (`prebuild` hook) zips skeleton at build time
- Lambda ZIP download uses `jszip` + `file-saver` client-side
- A11y fixed files ZIP also uses `jszip` + `file-saver`
- "Load Example" button pre-fills haunted React sample

## ✅ AgentProvider mounted
- Added `apps/src/app/layout.tsx` (root layout)
- Mounts `<AgentProvider>` around all children
- Provider auto-selects first available API on mount
- `checkProviders()` fetches from `/api/agent/status`
- `ready` state prevents premature calls

## ✅ Snippets fixed
- Landing page is server component (removed `onClick`)
- Lambda page has two-step workflow (spec editable before codegen)
- Added `maxDuration = 60` to API routes for long LLM calls
- File upload capped at 1MB (below Vercel's 4.5MB limit)
- React moved to `peerDependencies` + `devDependencies` in skeleton
- ESLint configured with `@typescript-eslint/parser` for TSX parsing
- All paths resolved correctly (`skeleton/lib/agent`, not `../lib/workflow`)

# Real Issues Fixed

## ✅ buildPrompt tells model the schema
- Each API route includes schema instructions in prompt
- Example: "Return JSON: { code: string, explanation: string }"
- Server validates with zod before returning
- One-shot self-heal retry on validation failure (OpenAI route)

## ✅ Spec editor is functional
- Lambda workflow split into two explicit steps
- Step 1: Generate spec, show in `SpecEditor` (user can edit)
- Step 2: Generate code from edited spec
- Separate buttons: "Generate Spec" → "Generate Code"

## ✅ a11y fix passes full findings
- Changed from just rule IDs to full finding objects
- Includes: line, col, ruleId, severity, message
- Agent task: "Fix these issues. Make MINIMAL changes."
- Basic parse check: result must include 'export' or 'function'

## ✅ Skeleton is domain-free
- Removed AWS helpers from `skeleton/lib/`
- AWS logic moved to `apps/src/app/lambda/lib/aws.ts`
- Agent client is transport-agnostic (no hardcoded `/api/agent/*`)
- Apps inject routes; skeleton just calls `fetch()`

## ✅ Mock/demo mode added
- `DEMO_MODE=true` env var returns cached fixtures
- Public URL works without live API keys until judging
- Fixtures stored in `apps/src/fixtures/`

## ✅ Testing rewritten for web
- Unit tests: agent parsing, scan engines, mocked routes
- Component tests: Vitest + React Testing Library
- E2E tests: Playwright with mocked agent responses
- Axe test: run axe-core on your own deployed site

## ✅ HACKATHON.md cleaned up
- Removed duplicate section 8
- Removed CLI-only content (bones doctor, Node 20+, etc.)
- Fixed Day 1 checklist (two folders, not three)
- Removed speculative "verified" Kiro-credit claims
- Timeline now includes Day 1 spike requirement

# Day 1 Spike Required

**First task on Oct 30:** Verify Kiro headless API exists.

1. Ask on Kiro Discord: "What's the headless API endpoint for Kiroween?"
2. Check docs for auth method, request shape, response shape
3. If exists: use it as default in `/api/agent/kiro/route.ts`
4. If not: switch default to OpenAI, keep Kiro as build evidence

Don't guess. Don't fake. Ask first.
