## Inspiration

The "Skeleton Crew" category asked for a template lean enough to be clear but flexible enough to prove itself with two distinct applications. I wanted that proof to be visible the moment a judge opens the site: one small component library, two completely unrelated products sharing it — and Kiro running *inside* the product, not just beside it. Most projects use AI to get built. I wanted one where AI is the engine users touch.

## What it does

**Lambda Scaffolder** (`/lambda`) turns one sentence into a deployable AWS Lambda package: describe the function → get an editable spec → generate the handler, a test file, and a README in Node.js or Python → copy or download each file, or grab one ZIP. The app detects the language and shows the exact AWS runtime and handler to pick, so deployment is three clicks in the AWS Console.

**A11y Auditor** (`/a11y`) hunts accessibility ghosts in any codebase. Drop files or a whole ZIP — it extracts in the browser, never on a server. Kiro AI audits every file for WCAG violations in any language, then fixes one file or all of them with diff previews. A ghost counter tracks the score, and an automatic re-scan proves it hit zero.

**Live demo:** http://18.143.74.194:3000

## How we built it

The `skeleton/` library ships 7 shared primitives — AgentProvider, SpecEditor, CodePreview, FileUpload, SpookyLoader, InfoModal — used by both apps, with ESLint `no-restricted-imports` enforcing that the apps never share domain code. The landing page shows this "Shared Anatomy" visually.

Every AI feature runs through one seam: Next.js API routes spawn `kiro-cli chat --no-interactive --trust-workspace`. The auditor sends files and parses WCAG findings as JSON. The scaffolder sends a prompt, gets a spec, then sends the spec back for code — spec before code, the Kiro philosophy. Responses stream heartbeat bytes so long LLM calls survive server timeouts.

The app is deployed on AWS EC2 (t3.micro, ≈$9.50/month) with kiro-cli authenticated on the instance via Google device flow — no SSH anywhere, all setup through cloud-init and SSM.

## Challenges we ran into

- **Timeouts everywhere.** Node kills sockets idle for 5 minutes; Kiro codegen can take 10. The fix: stream a heartbeat newline every 15 seconds until the real payload lands.
- **1 GB of RAM.** `next build` needs ~2 GB. A swap file lets the cheapest EC2 instance build and serve the app — the whole thing runs for about $9.50 a month.
- **Headless authentication.** No browser on the VM, no SSH allowed. SSM ran `kiro-cli login --use-device-flow --social google`; the code was approved from a laptop.
- **Kiro speaks prose, apps need structure.** The routes teach it contracts: JSON arrays for findings, fenced blocks with `lang:path` names for files, plain markdown for specs — and parse leniently, because no model is perfectly obedient.

## Accomplishments that we're proud of

- Kiro CLI is not just our dev tool — it **is** the product's backend. Every audit, spec, file, and fix is a live `kiro-cli` call.
- The auditor works on any language: JSX, HTML, Vue, even Python templates — because the AI reads code instead of a hardcoded rule list.
- The app passes its own medicine: axe-core runs in the Playwright suite on every populated page state. Zero serious violations.
- 16 automated tests: 10 skeleton unit, 4 route unit, 6 end-to-end flows — all green.
- A full AWS deployment for the price of two coffees a month, rebuilt twice from scratch by script alone.

## What we learned

Kiro CLI is a real runtime backend. Treat it like one: give it a contract, stream to keep connections alive, parse defensively, and it is dependable in production. We also learned that the cheapest demo is the one that survives its own build — swap and small instances beat big ones you forget to terminate.

## What's next for Skeleton — One Library, Two Haunted Apps

- A third app built from the same skeleton, proving the template scales beyond two.
- Streaming partial results into the UI as Kiro writes them, instead of one final payload.
- A public skeleton starter kit so anyone can scaffold a new app from the library in one click.
