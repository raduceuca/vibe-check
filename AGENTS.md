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
pnpm test:coverage                    # Coverage report (root vitest.config.ts projects + v8)
pnpm test:e2e:mcp                     # Packed widget → MCP round-trip (Playwright)
pnpm test:clients                     # Isolated Codex / Claude / Cursor MCP config checks
pnpm smoke:production                 # Public site smoke
pnpm gen:docs                         # Regenerate detector reference in READMEs + skill
pnpm release:validate -- <version>    # Versions, doc pins, CHANGELOG section, generated version
pnpm release:check-packages           # Pack the public packages and assert tarball contents

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
  `getSnapshot()`, `onSnapshot(cb)`. Snapshots carry each detector's run status
  (`detectors`, `engineStartedAt`), which the hub uses to verify fixes.
- **BeaconClient** — `fetch` POST to hub (truthful status); `sendBeacon` is
  legacy fallback only.
- **Utils** — `RingBuffer`, `featureDetect`.

### React (`@wcgw/vibe-check`)

- **VibeCheck** — six-tab overlay: Monitor, Agent, SEO, AEO, Prompts, Settings
- **PerfToggle** — keyboard toggle (**Alt+Shift+V**)
- **Hooks** — `useVibeCheck`, `useFrameRate`, `useWebVitals`, `useMemory`,
  `useLongFrames`, `useDetectedIssues`, `useIssueStore`, `useIssueWorkflow`,
  `usePreferences`, `useClipboard`
- **Context** — `VibeCheckProvider` / `useVibeCheckEngine`
- Inline styles only (no CSS files)

### MCP (`@wcgw/vibe-check-mcp`)

CLI roles:

| Command | Role |
|---------|------|
| `hub` | Long-running local hub (browser port, default 4200; `--port`) |
| `up` | Hub + printed setup/watch next-steps banner |
| `connect` | Stdio MCP bridge to the hub (spawned by agent clients) |
| `doctor` | Read-only connection diagnostics |
| `stats` | Project impact (human / json / markdown) |
| `setup` | Scaffold widget + agent config (`--agent` required) |
| `register` / `unregister` | Add or remove a project root in the local registry |

Browser requests to `/api/*` are accepted only from loopback origins
(`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`) or an allowlist
(`--allow-origin`, `VIBE_CHECK_ALLOWED_ORIGINS`, `register --origin`). POSTs must
be `application/json`.

**MCP tools (10)** — names, descriptions and parameters come from
`MCP_TOOL_CATALOG` in `packages/protocol/src/toolCatalog.ts`:

1. `list_projects` — List active local VibeCheck projects and their agent state
2. `get_project_impact` — Get persisted, browser-verified VibeCheck outcome statistics for one project
3. `get_performance_snapshot` — Get the latest browser performance snapshot for one project
4. `get_detected_issues` — Get active issues for one project, optionally filtered
5. `get_fix_suggestions` — Get a fix suggestion for one detected issue
6. `watch_performance` — Claim one project and wait for its next browser performance snapshot
7. `watch_for_issue` — Claim one project and wait for an issue explicitly sent from its widget
8. `acknowledge_issue` — Tell the widget this session is working on one issue in the project it watches
9. `resolve_issue` — Request browser-evidence verification after fixing an issue in one project
10. `release_project` — Release this agent session's project lease so another session can watch it

Tools 6–9 claim the session's exclusive project lease. A long-poll waits at most
55 s per call. `resolve_issue` takes `wait_seconds` (0–55) and returns the
verification outcome.

Issue workflow phases: **detected → sent → working → verifying → fixed / regressed**.
`sent` means queued for the owning session (not yet received); `working` means
the session received it. Queued issues survive `release_project` and session
exit, and hub restarts for registered projects. A verifying issue becomes `fixed` only when detectors that
observed the page after the request no longer report it
(`classifyVerificationSnapshot` in `packages/protocol/src/verification.ts`).
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
- Never type a version literal in source or docs. Setup commands are built from
  `MCP_PACKAGE_SPEC` (generated from `packages/mcp/package.json`), and
  `pnpm release:validate` fails on any doc pin that differs from the release
