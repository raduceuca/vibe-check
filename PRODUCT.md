# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user: a **solo AI-frontend builder** — one person shipping a React / Vite / Next app with Claude Code, Cursor, or Codex.

Situation: they just generated or edited a UI. It looks finished. They need to know what is actually wrong in the running browser and get one concrete finding into the agent session that owns the project.

Job: detect a real defect, send it to the agent, and know whether the next pass actually fixed it.

Teams, Vue/Svelte adapters, hosted multi-user tracking, and marketing-site conversion are not the first-class job. Design the overlay loop first.

## Product Purpose

VibeCheck is a browser performance and quality overlay for AI-built frontends. It measures the live page, names recurring vibe-coding defects (jank, DOM bloat, duplicate fetches, leaks, images, SEO/AEO), can dispatch one issue to the coding agent watching that project, and verifies the repair with fresh browser evidence.

Success: a solo builder completes detect → send → verify in a few minutes and leaves the overlay on during development.

## Positioning

Not a Lighthouse clone (one-shot lab score). Not Chrome DevTools MCP or Playwright MCP (general browser control). Not Datadog/Sentry (production APM).

The mechanism a neighbor cannot truthfully copy as a slogan: **named in-app detectors + exclusive project lease + Send to agent + browser-evidence verification + local impact receipts.**

Plain product language is binding. Lead with: a perf + SEO overlay that sends one issue to your coding agent and verifies the fix. Do not introduce press / printer / proof-sheet metaphor in new copy. Existing landing copy may still use that metaphor; rewrite it when the site is next touched. Print-mark chrome (crop ticks, CMYK strips, registration targets, “LIVE PROOF”, plate numbers) is banned.

## Operating Context

- Overlay mounts in the **developer's own app** (dev-only). Toggle: Alt+Shift+V.
- One long-running **local hub** (default `127.0.0.1:4200`) receives snapshots.
- Each agent client spawns a **stdio MCP bridge** (`connect`). One agent leases one `projectId` at a time.
- Workflow phases: detected → sent → working → verifying → fixed / regressed.
- Durable state lives in the project's `.vibecheck/state.json`.
- Supported agents today: Codex, Claude Code, Cursor.
- Public site (`apps/web`, vibecheck.wcgw.fun) and URL `/scan` exist as acquisition/docs; they are not the primary product surface.

## Capabilities and Constraints

Confirmed:

- Packages: `@wcgw/vibe-check-core` (zero runtime deps), `@wcgw/vibe-check` (React 18+ overlay, inline styles only), `@wcgw/vibe-check-mcp` (hub + MCP CLI), private `@wcgw/vibe-check-protocol`.
- Thirteen detectors including SEO and AEO audits.
- MCP tools include snapshot, issues, suggestions, `watch_for_issue`, verification, impact, leases.
- Widget is React-only today; core is framework-agnostic.
- Local-only: no hosted hub, no production RUM, no inventing traction or customer claims.
- MIT license (copyright WCGW, 2026).
- Name: **VibeCheck** (product); npm `@wcgw/vibe-check*`.

Undecided (do not invent):

- Vue / Svelte / vanilla official widgets
- Hosted or team-shared hub
- Paid tier
- Domain / brand beyond `VibeCheck` and current GitHub/npm identity
- Formal accessibility standard beyond “the overlay must be usable with keyboard and not lie about state”

## Brand Commitments

- Name: VibeCheck.
- Voice: plain, specific, honest about delivery (copied prompt ≠ sent). No press-check costume.
- Identity constraint: print-production decoration is not brand.
- No other locked visual system in this file (DESIGN.md is out of scope for init).

## Evidence on Hand

Real:

- Repo, README, and packed Playwright MCP round-trip GIF: `apps/web/public/demo/vibe-check-agent-roundtrip.gif`
- Live site: https://vibecheck.wcgw.fun
- npm packages at published versions (workspace may be ahead)
- Demo app that deliberately trips detectors
- Local dogfood on other apps (e.g. claudecraft) is valid usage evidence

Must not fabricate:

- Stars, customers, case studies, benchmarks, “used by”, quotes, or revenue

## Product Principles

1. **The overlay loop is the product.** Time-to-first green Send-to-agent receipt beats more detectors, more tabs, or more brand.
2. **Evidence over assertion.** A fix is fixed only when newer browser snapshots say so.
3. **One owner, one project.** Fail closed on ambiguous routing or a second watcher.
4. **Honest language.** Connection, delivery, and impact never flatter the agent or the tool.
5. **Stay local and light.** Zero-dep core, inline-style widget, no hosted requirement for the core job.
