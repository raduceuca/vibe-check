# AGENTS.md

This file provides guidance to coding agents when working in this repository.

## What This Is

Browser performance and quality monitoring for AI-assisted / vibe-coded frontends.
It runs collectors and detectors in the browser, renders a React overlay, and can
dispatch a concrete finding to one coding-agent session over MCP — then verify the
fix with fresh browser evidence.

Four packages form the pipeline:

| Package | npm | Role |
|---------|-----|------|
| `@wcgw/vibe-check-protocol` | private (bundled) | Shared wire types, enums, agent setup helpers |
| `@wcgw/vibe-check-core` | public | Zero-dep engine: collectors, detectors, beacon |
| `@wcgw/vibe-check` | public | React overlay widget |
| `@wcgw/vibe-check-mcp` | public | Local hub + stdio MCP bridge + setup/doctor CLI |

## Commands

```bash
pnpm install                          # Install all packages
pnpm build                            # Build all packages (tsup)
pnpm test                             # Run all tests
pnpm test:watch                       # Watch mode across all packages
pnpm lint                             # TypeScript type-check (tsc --noEmit)
pnpm test:coverage                    # Coverage report (vitest + v8)
pnpm test:e2e:mcp                     # Packed widget → MCP round-trip (Playwright)
pnpm test:clients                     # Isolated Codex / Claude / Cursor MCP config checks
pnpm smoke:production                 # Public site smoke
pnpm gen:docs                         # Regenerate detector reference in READMEs + skill

# Single package
cd packages/core && pnpm test
cd packages/mcp && pnpm test

# Single test file
npx vitest run packages/core/src/collectors/__tests__/frameRate.test.ts

# Demo app (deliberately broken page)
cd demo && pnpm dev

# Marketing site
cd apps/web && pnpm dev
```

## Architecture

### Data flow

```
Browser widget  ──POST /api/snapshot──►  Local hub (:4200)
     │                                      │
     │  Send to agent                       │ project queues, leases,
     ▼                                      │ workflow, impact ledger
On-page annotations                   .vibecheck/state.json
                                            ▲
                     MCP bridge (stdio) ────┘
                     Claude / Codex / Cursor
```

One long-running **hub** process is shared by local projects. Each agent client
spawns a short-lived **connect** bridge that never binds the browser port.
Projects are isolated by `projectId`. One agent may lease one project at a time.

### Package dependency chain

```
protocol (private) ──► core (zero runtime deps) ──► react (peer: React 18+)
protocol ──► mcp (depends on @modelcontextprotocol/sdk + zod)
```

`mcp` does **not** depend on `core`. It shares types via `protocol` (bundled at
build time). Apps: `apps/web` (marketing/docs/scan), `apps/scan-worker` (D1
leaderboard), `demo`, `e2e/mcp-roundtrip`.

### Core (`@wcgw/vibe-check-core`)

- **Collectors** (`src/collectors/`) — FPS, long frames, memory, web vitals,
  resources, console. Interface: `start` / `stop` / `getStats` / `onUpdate`.
- **Detectors** (`src/detectors/`) — 13 factories (`create*Detector()`): DOM
  bloat, duplicate requests, console spam, memory leak, layout thrashing,
  unoptimized/large images, long-task attribution, resource bloat, heavy
  library, web essentials, SEO, AEO.
- **Engine** (`src/engine.ts`) — `VibeCheckEngine`: `start()`, `stop()`,
  `getSnapshot()`, `onSnapshot(cb)`.
- **BeaconClient** — `fetch` POST to hub (truthful status); `sendBeacon` is
  legacy fallback only.
- **Utils** — `RingBuffer`, `featureDetect`.

### React (`@wcgw/vibe-check`)

- **VibeCheck** — six-tab overlay: Monitor, Agent, SEO, AEO, Prompts, Settings
- **PerfToggle** — keyboard toggle (**Alt+Shift+V**)
- **Hooks** — `useVibeCheck`, `useFrameRate`, `useWebVitals`, `useMemory`,
  `useLongFrames`, `useDetectedIssues`, `useIssueWorkflow`, `useProjectImpact`, …
- **Context** — `VibeCheckProvider` / `useVibeCheckEngine`
- Inline styles only (no CSS files)

### MCP (`@wcgw/vibe-check-mcp`)

CLI roles:

| Command | Role |
|---------|------|
| `hub` | Long-running local hub (browser port, default 4200) |
| `up` | Hub + printed setup/watch next-steps banner |
| `connect` | Stdio MCP bridge to the hub (spawned by agent clients) |
| `doctor` | Read-only connection diagnostics |
| `stats` | Project impact (human / json / markdown) |
| `setup` | Scaffold widget + agent config (`--agent` required) |
| `register` | Register a project root in the local registry |

**MCP tools (10):**

1. `list_projects` — active projects and watcher state
2. `get_project_impact` — verified fixes, regressions, measured deltas
3. `get_performance_snapshot` — latest snapshot
4. `get_detected_issues` — filter by severity / detector
5. `get_fix_suggestions` — structured fix guide for one issue
6. `watch_performance` — wait for next snapshot (acquires lease)
7. `watch_for_issue` — claim project; wait for widget **Send to agent**
8. `acknowledge_issue` — mark seen
9. `resolve_issue` — request **browser-evidence verification** (not instant "fixed")
10. `release_project` — drop this session's lease

Issue workflow phases: **detected → sent → working → verifying → fixed / regressed**.
Durable state lives in the project's `.vibecheck/state.json` (hub-owned).

### Skill (`skills/vibe-check/`)

User-invocable skill for setup and MCP workflow. Keep it in sync with the tool
list and lease/verify semantics above.

## Rules

- TypeScript strict mode, no `any`
- Named arrow function exports only (no `export default`)
- Immutable patterns — never mutate inputs, return new objects
- Core package has **zero** runtime dependencies
- React package peer-depends on React 18+
- All UI uses inline styles (no CSS files)
- Tests live in `__tests__/` co-located with source
- Test environment is `jsdom` with vitest globals
- Every collector, detector, hook, and MCP tool needs tests
- Build toolchain: tsup (ESM + CJS dual output with declarations)
- Do not claim a copied prompt was delivered — only a successful
  `watch_for_issue` result confirms widget-to-agent dispatch
- On `lease-conflict`, do not retry in a loop; explain ownership
