# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Browser performance monitoring plugin for detecting issues caused by AI-assisted/vibe coding. Three packages form a pipeline: **core** collects metrics in the browser, **react** renders an overlay widget, and **mcp** exposes the data to AI agents via MCP tools + HTTP.

## Commands

```bash
pnpm install                          # Install all packages
pnpm build                            # Build all packages (tsup)
pnpm test                             # Run all tests
pnpm test:watch                       # Watch mode across all packages
pnpm lint                             # TypeScript type-check (tsc --noEmit)
pnpm test:coverage                    # Coverage report (vitest + v8)

# Single package
cd packages/core && pnpm test         # Test core only
cd packages/mcp && pnpm test          # Test mcp only

# Single test file
npx vitest run packages/core/src/collectors/__tests__/frameRate.test.ts

# Watch a single test
npx vitest packages/core/src/detectors/__tests__/domBloat.test.ts

# Build a single package
cd packages/core && pnpm build

# Run demo app
cd demo && pnpm dev
```

## Architecture

### Data Flow

```
Browser (core collectors) → VibeCheckEngine → BeaconClient (POST /api/snapshot)
                                                      ↓
                                              MCP Server (httpServer)
                                                      ↓
                                              VibeStore (immutable state)
                                                      ↓
                                              MCP Tools (AI agent reads)
```

### Package Dependency Chain

`core` (zero deps) → `react` (depends on core) → consumer app
`mcp` (standalone, depends on `@modelcontextprotocol/sdk` + `zod`)

The MCP package does NOT depend on core. It receives snapshots over HTTP and has its own `types.ts` mirroring core's `VibeSnapshot` shape.

### Core Package (`@wcgw/vibe-check-core`)

- **Collectors** (`src/collectors/`) — measure browser metrics (FPS, long frames, memory, web vitals, resources, console). Each implements `Collector<T>` interface with `start/stop/getStats/onUpdate`.
- **Detectors** (`src/detectors/`) — analyze snapshots for problems (DOM bloat, duplicate requests, memory leaks, etc.). Each is a factory function `create*Detector()` returning a `Detector` with `start/stop/getIssues/clear`. Issues are created via `createIssue()`.
- **Engine** (`src/engine.ts`) — orchestrates collectors + detectors + beacon. `VibeCheckEngine` is the main entry point: `start()`, `stop()`, `getSnapshot()`, `onSnapshot(cb)`.
- **BeaconClient** (`src/beacon/`) — sends snapshots to MCP server via `navigator.sendBeacon` or `fetch` POST to `/api/snapshot`.
- **RingBuffer** (`src/utils/ringBuffer.ts`) — fixed-capacity circular buffer used by collectors.
- **featureDetect** (`src/utils/featureDetect.ts`) — checks browser API availability (PerformanceObserver, LoAF, etc.).

### React Package (`@wcgw/vibe-check`)

- **VibeCheck** component — full overlay widget with panels (FPS, vitals, memory, issues)
- **PerfToggle** component — keyboard-toggled (Ctrl+Shift+P) wrapper around VibeCheck
- **Hooks** — `useVibeCheck` (creates + manages engine), `useFrameRate`, `useWebVitals`, `useMemory`, `useLongFrames`, `useDetectedIssues`
- **Context** — `VibeCheckProvider` / `useVibeCheckEngine` for shared engine access
- All UI uses **inline styles only** — no CSS files or dependencies

### MCP Package (`@wcgw/vibe-check-mcp`)

- **httpServer** — receives POST `/api/snapshot` from browser beacon, serves SSE at `/api/stream`, health check at `/api/health`. Port defaults to 4200 (env: `VIBE_CHECK_PORT`).
- **store** — immutable `VibeStore` with `updateSnapshot`, `acknowledgeIssue`, `resolveIssue`. Keeps last 100 issues in history.
- **mcpServer** — registers 6 MCP tools: `get_performance_snapshot`, `get_detected_issues`, `get_fix_suggestions`, `watch_performance`, `acknowledge_issue`, `resolve_issue`.
- **suggestions** — maps each `DetectorName` to a markdown template with causes, fix steps, and code examples.
- Entry point runs both HTTP server (for browser) and stdio MCP transport (for AI agent) simultaneously.

### Claude Code Skill (`skills/vibe-check/`)

`SKILL.md` provides a user-invocable skill for setting up vibe-check in a project and using the MCP tools.

## Rules

- TypeScript strict mode, no `any`
- Named arrow function exports only (no `export default`)
- Immutable patterns — never mutate inputs, return new objects (see `store.ts` for reference)
- Core package has **zero** runtime dependencies
- React package peer-depends on React 18+
- All UI uses inline styles (no CSS files)
- Tests live in `__tests__/` directories co-located with source
- Test environment is `jsdom` with vitest globals enabled
- Every collector, detector, hook, and MCP tool needs tests
- Build toolchain: tsup (ESM + CJS dual output with declarations)
