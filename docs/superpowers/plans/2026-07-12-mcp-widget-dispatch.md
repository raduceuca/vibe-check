# MCP Widget-to-Agent Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a real, project-isolated widget-to-agent workflow in which one agent session watches one local project, a widget button dispatches a detected issue through MCP, and a packaged Playwright test proves the complete clean-install path.

**Architecture:** One loopback HTTP hub owns browser ingestion and project-scoped state. Each agent client spawns a stdio bridge that talks to the hub, acquires one exclusive project lease, and exposes project-scoped MCP tools. The browser derives its UI state from the hub and only marks an issue sent after confirmed dispatch.

**Tech Stack:** TypeScript 5.9, Node.js 20+, React 18+, MCP SDK 1.27, Zod 3.25, Vitest 4, Playwright, Vite 8, pnpm 10.

## Global Constraints

- Keep `@wcgw/vibe-check-core` at zero runtime dependencies.
- Use strict TypeScript with no `any`; preserve named arrow-function exports.
- Keep React UI inline-styled; add no CSS files or styling dependency.
- Keep browser-facing services on `127.0.0.1` unless explicitly overridden.
- Apply CORS only to `/api/*`; reject any request carrying an `Origin` header on `/internal/*` bridge routes.
- Default project identity to `window.location.origin`; support an explicit `projectId` override.
- Allow one agent lease per project and one project lease per agent bridge.
- Heartbeat every 5 seconds; mark stale at 10 seconds; expire at 15 seconds.
- Keep at most 10 queued dispatches per project lease.
- Retain a rejected second-agent warning for 30 seconds without replacing the healthy owner state.
- Treat a project as active for 10 seconds after its latest browser snapshot.
- Poll widget project status every 2 seconds while the document is visible.
- Run the packaged E2E test and CI on Node 20.
- Do not connect the public marketing widget to a visitor's local hub.

---

## File Map

### Shared protocol

- Modify `packages/protocol/src/index.ts` — project envelopes, project status, dispatch, lease, and hub response types.
- Modify `packages/protocol/src/__tests__/protocol.test.ts` — contract and enum coverage.

### MCP hub and bridge

- Modify `packages/mcp/src/schema.ts` — deeply bounded parsers for snapshot envelopes, issue dispatches, and internal requests.
- Modify `packages/mcp/src/store.ts` — retain the immutable single-project issue-history helpers.
- Create `packages/mcp/src/hubStore.ts` — immutable multi-project registry, lease state, queues, and conflict state.
- Create `packages/mcp/src/__tests__/hubStore.test.ts` — deterministic state-machine tests with injected timestamps.
- Replace `packages/mcp/src/httpServer.ts` with `packages/mcp/src/hubServer.ts` — browser and bridge HTTP routes plus long-poll waiters.
- Replace `packages/mcp/src/__tests__/httpServer.test.ts` with `packages/mcp/src/__tests__/hubServer.test.ts`.
- Create `packages/mcp/src/hubClient.ts` — typed bridge-to-hub HTTP client.
- Create `packages/mcp/src/leaseManager.ts` — one-project lease ownership and heartbeat lifecycle for a bridge.
- Create `packages/mcp/src/__tests__/hubClient.test.ts` and `packages/mcp/src/__tests__/leaseManager.test.ts`.
- Modify `packages/mcp/src/mcpServer.ts` and its test — project-scoped tools plus `list_projects`, `watch_for_issue`, and `release_project`.
- Create `packages/mcp/src/cli.ts` and its test — `hub`/`connect` argument and environment parsing.
- Modify `packages/mcp/src/index.ts`, `lib.ts`, and `tsup.config.ts` — role-based startup, exports, and package-version injection.

### Browser core

- Modify `packages/core/src/types.ts` and `index.ts` — re-export hub contracts and accept `projectId`.
- Modify `packages/core/src/beacon/beaconClient.ts` and its test — project envelope, status polling, and issue dispatch.
- Modify `packages/core/src/engine.ts`, `scriptedEngine.ts`, and their tests — expose status and dispatch through `VibeEngine`.

### React widget

- Create `packages/react/src/panels/AgentConnectionStatus.tsx` and its test — truthful status/instruction UI.
- Modify `packages/react/src/panels/AgentPanel.tsx` and add a focused test — independent send and copy actions.
- Modify `packages/react/src/panels/AuditPanel.tsx` and `AnnotationOverlay.tsx` — clipboard actions no longer mark issues sent.
- Modify `packages/react/src/panels/SettingsPanel.tsx` — full hub/lease states and recovery instructions.
- Modify `packages/react/src/VibeCheck.tsx` and its test — `projectId`, real dispatch, and sent-state transitions.

### Documentation and verification

- Modify `README.md`, package READMEs, `demo/README.md`, `skills/vibe-check/SKILL.md`, and MCP-related site documentation.
- Modify `apps/web/components/landing/AgentRoundTrip.tsx` and `apps/web/app/page.tsx` — truthful illustrative copy and real tool shapes.
- Create `e2e/mcp-roundtrip/` — clean-install fixtures, orchestration, Playwright configuration, and tests.
- Modify `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` — E2E dependencies and scripts.
- Create `.github/workflows/ci.yml` — package checks plus Chromium E2E.

---

### Task 1: Extend the Shared Wire Contract

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/__tests__/protocol.test.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/mcp/src/types.ts`

**Interfaces:**
- Produces: `ProjectSnapshotEnvelope`, `ProjectSummary`, `ProjectStatus`, `DispatchIssueRequest`, `DispatchIssueResponse`, `QueuedIssue`, `LeaseResult`, and their string-union codes.
- Consumes: existing `VibeIssue` and `VibeSnapshot`.

- [ ] **Step 1: Write failing protocol contract tests**

Add assertions that instantiate every new type without casts and verify the frozen state arrays:

```ts
import {
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
  type ProjectSnapshotEnvelope,
  type ProjectStatus,
  type DispatchIssueResponse,
} from '../index.js'

it('defines the project routing and dispatch contract', () => {
  const envelope: ProjectSnapshotEnvelope = {
    projectId: 'http://localhost:5173',
    instanceId: 'browser-a',
    origin: 'http://localhost:5173',
    title: 'Fixture A',
    snapshot: makeSnapshot(),
  }
  const status: ProjectStatus = {
    projectId: envelope.projectId,
    state: 'watching',
    queueDepth: 0,
    leaseExpiresAt: 15_000,
    conflictAt: null,
  }
  const response: DispatchIssueResponse = {
    ok: true,
    code: 'dispatched',
    projectId: envelope.projectId,
    queueDepth: 0,
  }
  expect(status.state).toBe('watching')
  expect(response.code).toBe('dispatched')
  expect(AGENT_CONNECTION_STATES).toEqual(['no-agent', 'watching', 'busy', 'stale'])
  expect(DISPATCH_RESULT_CODES).toEqual([
    'dispatched', 'unconfigured', 'hub-offline', 'agent-not-watching',
    'queue-full', 'invalid-issue', 'failed',
  ])
})
```

- [ ] **Step 2: Run the protocol test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-protocol test -- protocol.test.ts`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Add the exact shared contracts**

Append to `packages/protocol/src/index.ts`:

```ts
export const AGENT_CONNECTION_STATES = ['no-agent', 'watching', 'busy', 'stale'] as const
export type AgentConnectionState = (typeof AGENT_CONNECTION_STATES)[number]

export const DISPATCH_RESULT_CODES = [
  'dispatched',
  'unconfigured',
  'hub-offline',
  'agent-not-watching',
  'queue-full',
  'invalid-issue',
  'failed',
] as const
export type DispatchResultCode = (typeof DISPATCH_RESULT_CODES)[number]

export interface ProjectSnapshotEnvelope {
  readonly projectId: string
  readonly instanceId: string
  readonly origin: string
  readonly title: string
  readonly snapshot: VibeSnapshot
}

export interface ProjectSummary {
  readonly projectId: string
  readonly origin: string
  readonly title: string
  readonly instanceCount: number
  readonly lastSeenAt: number
  readonly agentState: AgentConnectionState
}

export interface ProjectStatus {
  readonly projectId: string
  readonly state: AgentConnectionState
  readonly queueDepth: number
  readonly leaseExpiresAt: number | null
  readonly conflictAt: number | null
}

export interface DispatchIssueRequest {
  readonly projectId: string
  readonly instanceId: string
  readonly issue: VibeIssue
}

export interface DispatchIssueResponse {
  readonly ok: boolean
  readonly code: DispatchResultCode
  readonly projectId: string
  readonly queueDepth: number
}

export interface QueuedIssue {
  readonly projectId: string
  readonly issue: VibeIssue
  readonly snapshot: VibeSnapshot
  readonly dispatchedAt: number
}

export type LeaseResult =
  | { readonly ok: true; readonly projectId: string; readonly expiresAt: number }
  | { readonly ok: false; readonly code: 'project-not-found' | 'lease-conflict' | 'session-already-watching'; readonly projectId: string }
```

Re-export these types and constants from core and MCP type barrels.

- [ ] **Step 4: Run protocol, core lint, and MCP lint**

Run: `pnpm --filter @wcgw/vibe-check-protocol test && pnpm --filter @wcgw/vibe-check-core lint && pnpm --filter @wcgw/vibe-check-mcp lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/index.ts packages/protocol/src/__tests__/protocol.test.ts packages/core/src/types.ts packages/core/src/index.ts packages/mcp/src/types.ts
git commit -m "feat(protocol): add project and dispatch contracts"
```

---

### Task 2: Build the Immutable Multi-Project Hub Store

**Files:**
- Create: `packages/mcp/src/hubStore.ts`
- Create: `packages/mcp/src/__tests__/hubStore.test.ts`
- Modify: `packages/mcp/src/store.ts`

**Interfaces:**
- Consumes: `ProjectSnapshotEnvelope`, `VibeIssue`, `QueuedIssue`, and the existing immutable `VibeStore` helpers.
- Produces: `HubStore`, `recordSnapshot`, `listActiveProjects`, `acquireLease`, `heartbeatLease`, `releaseLease`, `dispatchIssue`, `dequeueIssue`, `getProjectStatus`, `getActiveIssues`, `findProjectIssue`, and project-scoped issue actions.

- [ ] **Step 1: Write failing state-machine tests**

Cover isolation, automatic active-project filtering, one-project-per-session, lease conflict, stale/expiry thresholds, ten-item queue capacity, conflict retention, and ownership release. Use fixed `now` values; do not use timers.

```ts
it('keeps projects isolated and rejects a second watcher', () => {
  let hub = createHubStore()
  hub = recordSnapshot(hub, makeEnvelope('project-a', 'a'), 1_000)
  hub = recordSnapshot(hub, makeEnvelope('project-b', 'b'), 1_000)

  const first = acquireLease(hub, 'project-a', 'agent-a', 2_000)
  expect(first.result).toEqual({ ok: true, projectId: 'project-a', expiresAt: 17_000 })
  hub = first.store

  const conflict = acquireLease(hub, 'project-a', 'agent-b', 3_000)
  expect(conflict.result).toEqual({ ok: false, code: 'lease-conflict', projectId: 'project-a' })
  expect(getProjectStatus(conflict.store, 'project-a', 3_000).conflictAt).toBe(3_000)
  expect(getProjectStatus(conflict.store, 'project-b', 3_000).state).toBe('no-agent')
})

it('marks a missing heartbeat stale at 10s and expires it at 15s', () => {
  const claimed = claimProject('project-a', 'agent-a', 1_000)
  expect(getProjectStatus(claimed, 'project-a', 10_999).state).toBe('watching')
  expect(getProjectStatus(claimed, 'project-a', 11_000).state).toBe('stale')
  expect(getProjectStatus(claimed, 'project-a', 16_000).state).toBe('no-agent')
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- hubStore.test.ts`

Expected: FAIL because `hubStore.ts` does not exist.

- [ ] **Step 3: Implement the store with exact timing constants**

Start `hubStore.ts` with:

```ts
export const PROJECT_ACTIVE_MS = 10_000
export const LEASE_HEARTBEAT_MS = 5_000
export const LEASE_STALE_MS = 10_000
export const LEASE_EXPIRE_MS = 15_000
export const CONFLICT_VISIBLE_MS = 30_000
export const MAX_DISPATCH_QUEUE = 10

interface AgentLease {
  readonly sessionId: string
  readonly heartbeatAt: number
  readonly mode: 'watching' | 'busy'
}

interface BrowserInstance {
  readonly instanceId: string
  readonly origin: string
  readonly title: string
  readonly lastSeenAt: number
}

export interface HubProject {
  readonly projectId: string
  readonly instances: ReadonlyMap<string, BrowserInstance>
  readonly store: VibeStore
  readonly queue: readonly QueuedIssue[]
  readonly lease: AgentLease | null
  readonly conflictAt: number | null
}

export interface HubStore {
  readonly projects: ReadonlyMap<string, HubProject>
  readonly sessionProjects: ReadonlyMap<string, string>
}

export const createHubStore = (): HubStore => ({
  projects: new Map(),
  sessionProjects: new Map(),
})
```

Implement every update by cloning only the affected maps/project. `acquireLease` must first clear expired leases, then reject when `sessionProjects` maps the caller to another project, preserve an existing owner on conflict, and set `conflictAt` on the rejected project. Add `markLeaseWatching` and `markLeaseBusy`, both owner-checked. `dispatchIssue` must require a non-stale owner and reject the eleventh queued issue with `queue-full`. `getProjectStatus` derives `watching`/`busy` from `lease.mode`, not merely from queue depth.

- [ ] **Step 4: Run hub-store and existing store tests**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- hubStore.test.ts store.test.ts`

Expected: PASS with tests for all constants and state transitions.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/hubStore.ts packages/mcp/src/__tests__/hubStore.test.ts packages/mcp/src/store.ts
git commit -m "feat(mcp): add isolated project hub store"
```

---

### Task 3: Expose Browser and Bridge Hub HTTP APIs

**Files:**
- Modify: `packages/mcp/src/schema.ts`
- Create: `packages/mcp/src/hubServer.ts`
- Create: `packages/mcp/src/__tests__/hubServer.test.ts`
- Delete: `packages/mcp/src/httpServer.ts`
- Delete: `packages/mcp/src/__tests__/httpServer.test.ts`

**Interfaces:**
- Consumes: all `hubStore` functions.
- Produces: `createHubServer(options): HubServerContext` and these route families: `/api/*` for browsers, `/internal/*` for bridges.

- [ ] **Step 1: Write failing HTTP tests for exact routes**

Test:

```text
GET  /api/health
POST /api/snapshot
GET  /api/projects/:projectId/status
POST /api/projects/:projectId/dispatch
GET  /internal/projects
GET  /internal/projects/:projectId/snapshot
GET  /internal/projects/:projectId/issues
GET  /internal/projects/:projectId/issues/:issueId
POST /internal/projects/:projectId/leases/acquire
POST /internal/projects/:projectId/leases/heartbeat
POST /internal/projects/:projectId/leases/release
POST /internal/projects/:projectId/issues/next
POST /internal/projects/:projectId/issues/:issueId/acknowledge
POST /internal/projects/:projectId/issues/:issueId/resolve
POST /internal/projects/:projectId/snapshots/next
```

The dispatch/long-poll test must begin `issues/next`, POST a browser dispatch, and assert the pending response receives the same issue. The second-agent test must assert HTTP `409`, owner preservation, and `conflictAt` in browser status.

- [ ] **Step 2: Run the server test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- hubServer.test.ts`

Expected: FAIL because the hub server does not exist.

- [ ] **Step 3: Add bounded Zod parsers**

Extract and export `issueSchema`, then add:

```ts
const idSchema = z.string().trim().min(1).max(2000)

export const projectSnapshotEnvelopeSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  origin: boundedString,
  title: boundedString,
  snapshot: snapshotSchema,
})

export const dispatchIssueRequestSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  issue: issueSchema,
})

export const leaseRequestSchema = z.object({ sessionId: idSchema })
export const waitRequestSchema = z.object({
  sessionId: idSchema,
  timeoutSeconds: z.number().min(1).max(300),
})
```

- [ ] **Step 4: Implement `createHubServer`**

Use `new URL(req.url ?? '/', 'http://localhost')` and `decodeURIComponent` for project/issue segments. Return health as:

```ts
{ status: 'ok', service: 'vibe-check-hub', version }
```

Keep a mutable `HubStore` only inside the server context and expose read-only `getStore()`. Maintain separate pending waiter maps for issue dispatches and snapshots. Beginning `issues/next` marks the owning lease `watching`; delivering/dequeuing an issue marks it `busy`. A later `issues/next` moves the same owner back to `watching`. On dispatch, update the queue, then resolve one waiter owned by the lease session by dequeuing exactly one issue. Cancel waiters on timeout and request close. Close all waiters with a structured `hub-shutdown` response during `close()`. Apply CORS headers and preflight handling only to `/api/*`; return `403` from `/internal/*` whenever the request contains an `Origin` header so browser JavaScript cannot call bridge-only lease routes.

- [ ] **Step 5: Run MCP tests and lint**

Run: `pnpm --filter @wcgw/vibe-check-mcp test && pnpm --filter @wcgw/vibe-check-mcp lint`

Expected: PASS; no route can read another project without its encoded ID.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/schema.ts packages/mcp/src/hubServer.ts packages/mcp/src/__tests__/hubServer.test.ts packages/mcp/src/httpServer.ts packages/mcp/src/__tests__/httpServer.test.ts
git commit -m "feat(mcp): add project-scoped local hub API"
```

---

### Task 4: Add the Typed Hub Client and Exclusive Lease Manager

**Files:**
- Create: `packages/mcp/src/hubClient.ts`
- Create: `packages/mcp/src/leaseManager.ts`
- Create: `packages/mcp/src/__tests__/hubClient.test.ts`
- Create: `packages/mcp/src/__tests__/leaseManager.test.ts`

**Interfaces:**
- Produces: `HubClient`, `createHubClient(baseUrl)`, `LeaseManager`, and `createLeaseManager(client, sessionId)`.
- Consumes: hub HTTP routes from Task 3.

- [ ] **Step 1: Write failing client and heartbeat tests**

Use a real ephemeral hub server for `HubClient`. Use fake timers and a fake client for `LeaseManager`. Assert that claiming project B after A is rejected locally, heartbeats run every 5 seconds, and `stop()` releases A.

```ts
it('heartbeats and releases its single project', async () => {
  vi.useFakeTimers()
  const client = makeFakeHubClient()
  const manager = createLeaseManager(client, 'agent-a')
  await manager.acquire('project-a')
  await vi.advanceTimersByTimeAsync(10_000)
  expect(client.heartbeatLease).toHaveBeenCalledTimes(2)
  await manager.stop()
  expect(client.releaseLease).toHaveBeenCalledWith('project-a', 'agent-a')
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- hubClient.test.ts leaseManager.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the client interface**

```ts
export interface HubClient {
  health(): Promise<{ readonly status: 'ok'; readonly service: 'vibe-check-hub'; readonly version: string }>
  listProjects(): Promise<readonly ProjectSummary[]>
  getSnapshot(projectId: string): Promise<VibeSnapshot | null>
  getDetectedIssues(projectId: string, filters?: { readonly severity?: string; readonly detector?: string }): Promise<readonly VibeIssue[]>
  getIssue(projectId: string, issueId: string): Promise<VibeIssue | null>
  waitForSnapshot(projectId: string, sessionId: string, timeoutSeconds: number): Promise<VibeSnapshot | null>
  acquireLease(projectId: string, sessionId: string): Promise<LeaseResult>
  heartbeatLease(projectId: string, sessionId: string): Promise<LeaseResult>
  releaseLease(projectId: string, sessionId: string): Promise<void>
  waitForIssue(projectId: string, sessionId: string, timeoutSeconds: number): Promise<QueuedIssue | null>
  acknowledgeIssue(projectId: string, issueId: string): Promise<void>
  resolveIssue(projectId: string, issueId: string): Promise<void>
}
```

Every non-2xx response must throw `HubClientError` carrying `status`, `code`, and parsed response body. Verify `health.service === 'vibe-check-hub'`; never accept an arbitrary process on the port.

- [ ] **Step 4: Implement the lease manager**

`LeaseManager` exposes `currentProjectId(): string | null`. `acquire(projectId)` calls the hub, starts one 5-second interval only after success, and records the project. `stop()` clears the interval and releases the lease. A heartbeat `lease-conflict` or `project-not-found` stops ownership and clears the interval.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- hubClient.test.ts leaseManager.test.ts`

Expected: PASS.

```bash
git add packages/mcp/src/hubClient.ts packages/mcp/src/leaseManager.ts packages/mcp/src/__tests__/hubClient.test.ts packages/mcp/src/__tests__/leaseManager.test.ts
git commit -m "feat(mcp): add hub bridge client and lease heartbeat"
```

---

### Task 5: Convert MCP Tools into a Project-Scoped Bridge

**Files:**
- Modify: `packages/mcp/src/mcpServer.ts`
- Modify: `packages/mcp/src/__tests__/mcpServer.test.ts`
- Create: `packages/mcp/src/cli.ts`
- Create: `packages/mcp/src/__tests__/cli.test.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/src/lib.ts`
- Modify: `packages/mcp/tsup.config.ts`

**Interfaces:**
- Consumes: `HubClient` and `LeaseManager`.
- Produces: nine project-aware tools and `parseCliConfig(argv, env)`.

- [ ] **Step 1: Rewrite MCP tests around a fake `HubClient`**

Require these behaviors:

- `list_projects` returns active project summaries.
- Omitted `project_id` selects the only active project.
- Omitted `project_id` with two projects returns `project-ambiguous` plus both candidates.
- `watch_for_issue` acquires the lease, waits, and returns issue, snapshot, suggestion, and timestamps.
- A second bridge receives `lease-conflict` as an MCP error result.
- `release_project` releases only the caller's project.
- Existing snapshot, issue, suggestion, watch, acknowledge, and resolve tools use the selected project.

```ts
const result = await callTool(server, 'watch_for_issue', {
  project_id: 'http://localhost:5173',
  timeout_seconds: 30,
})
expect(JSON.parse(result.content[0]!.text)).toMatchObject({
  projectId: 'http://localhost:5173',
  issue: { id: 'dom-1', detector: 'dom-bloat' },
  suggestion: expect.stringContaining('DOM Bloat'),
})
```

- [ ] **Step 2: Run MCP tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- mcpServer.test.ts`

Expected: FAIL against the old in-process store API.

- [ ] **Step 3: Implement project resolution once and reuse it**

```ts
const resolveProject = async (
  client: HubClient,
  leases: LeaseManager,
  requested: string | undefined,
): Promise<{ readonly ok: true; readonly projectId: string } | { readonly ok: false; readonly payload: unknown }> => {
  const projects = await client.listProjects()
  const owned = leases.currentProjectId()
  if (owned && requested && requested !== owned) {
    return {
      ok: false,
      payload: { error: 'This agent is already watching another project', code: 'session-already-watching', projectId: owned },
    }
  }
  if (owned) return { ok: true, projectId: owned }
  if (requested) {
    return projects.some((project) => project.projectId === requested)
      ? { ok: true, projectId: requested }
      : { ok: false, payload: { error: 'Project not found', code: 'project-not-found', projects } }
  }
  if (projects.length === 1) return { ok: true, projectId: projects[0]!.projectId }
  return {
    ok: false,
    payload: {
      error: projects.length === 0 ? 'No active VibeCheck project' : 'Multiple VibeCheck projects are active',
      code: projects.length === 0 ? 'no-projects' : 'project-ambiguous',
      projects,
    },
  }
}
```

Add optional `project_id` to every existing project-reading/action tool. Add `list_projects`, `watch_for_issue`, and `release_project`. Keep `watch_performance` snapshot-only. Once the bridge owns a lease, every project-scoped tool must use that project and reject an explicitly different `project_id` until `release_project` succeeds.

- [ ] **Step 4: Implement explicit CLI roles**

```ts
export type CliConfig =
  | { readonly role: 'hub'; readonly host: string; readonly port: number }
  | { readonly role: 'connect'; readonly hubUrl: string }

export const parseCliConfig = (argv: readonly string[], env: NodeJS.ProcessEnv): CliConfig => {
  const role = argv[0]
  if (role === 'hub') return { role, host: env['VIBE_CHECK_HOST'] ?? '127.0.0.1', port: parsePort(env['VIBE_CHECK_PORT']) }
  if (role === 'connect') return { role, hubUrl: env['VIBE_CHECK_HUB_URL'] ?? 'http://127.0.0.1:4200' }
  throw new Error('Usage: vibe-check-mcp hub | vibe-check-mcp connect')
}
```

`index.ts` starts exactly one role. `connect` verifies hub health before connecting stdio, generates `crypto.randomUUID()` for the session, and releases the lease on SIGINT/SIGTERM/stdin close. `hub` never opens stdio.

- [ ] **Step 5: Inject the package version at build time**

Read `packages/mcp/package.json` inside `tsup.config.ts` and define `__VIBE_CHECK_VERSION__`. Declare it in `index.ts`/`mcpServer.ts` and use it for hub health and MCP handshake. Add a test comparing the handshake version to `package.json`.

- [ ] **Step 6: Run MCP tests, lint, and build**

Run: `pnpm --filter @wcgw/vibe-check-mcp test && pnpm --filter @wcgw/vibe-check-mcp lint && pnpm --filter @wcgw/vibe-check-mcp build`

Expected: PASS; `node packages/mcp/dist/index.js` without a role exits with the usage message.

- [ ] **Step 7: Commit**

```bash
git add packages/mcp/src/mcpServer.ts packages/mcp/src/__tests__/mcpServer.test.ts packages/mcp/src/cli.ts packages/mcp/src/__tests__/cli.test.ts packages/mcp/src/index.ts packages/mcp/src/lib.ts packages/mcp/tsup.config.ts
git commit -m "feat(mcp): add project-scoped stdio bridge tools"
```

---

### Task 6: Add Browser Project Status and Immediate Dispatch

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/beacon/beaconClient.ts`
- Modify: `packages/core/src/beacon/__tests__/beaconClient.test.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/scriptedEngine.ts`
- Modify: `packages/core/src/__tests__/engine.test.ts`
- Modify: `packages/core/src/__tests__/scriptedEngine.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `projectId` config, expanded `BeaconStatus`, and `VibeEngine.dispatchIssue(issue)`.
- Consumes: browser hub routes from Task 3.

- [ ] **Step 1: Write failing beacon tests**

Test default origin identity, explicit project ID, stable per-client instance ID, wrapped snapshots, visible-only 2-second status polling, immediate refresh on visibility, successful dispatch, offline dispatch, and queue-full dispatch.

```ts
expect(fetch).toHaveBeenCalledWith(
  'http://127.0.0.1:4200/api/snapshot',
  expect.objectContaining({
    body: expect.stringContaining('"projectId":"http://localhost:5173"'),
  }),
)

await expect(client.dispatchIssue(makeIssue())).resolves.toMatchObject({
  ok: true,
  code: 'dispatched',
})
```

- [ ] **Step 2: Run beacon tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-core test -- beaconClient.test.ts`

Expected: FAIL because project routing and dispatch do not exist.

- [ ] **Step 3: Expand config and engine interfaces**

Add `readonly projectId?: string` to `VibeCheckConfig`. Expand `BeaconStatus`:

```ts
export interface BeaconStatus {
  readonly configured: boolean
  readonly projectId: string
  readonly instanceId: string
  readonly lastAttemptAt: number | null
  readonly lastOk: boolean | null
  readonly projectStatus: ProjectStatus | null
  readonly statusError: 'hub-offline' | null
}
```

Add to `VibeEngine`:

```ts
dispatchIssue(issue: VibeIssue): Promise<DispatchIssueResponse>
```

The live engine delegates to `BeaconClient`; the scripted engine returns `{ ok: false, code: 'unconfigured', projectId: 'scripted', queueDepth: 0 }`.

- [ ] **Step 4: Implement envelope, status polling, and dispatch**

Resolve identity once in the client constructor:

```ts
const projectId = config.projectId ?? (typeof window !== 'undefined' ? window.location.origin : 'unknown-project')
const instanceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `instance-${Date.now()}-${Math.random().toString(36).slice(2)}`
```

POST `ProjectSnapshotEnvelope` to `/api/snapshot`. Poll encoded `/api/projects/:projectId/status` every 2 seconds only while visible. POST `DispatchIssueRequest` to `/api/projects/:projectId/dispatch` and translate network failure into `hub-offline`; never throw into the host application.

- [ ] **Step 5: Run core tests, lint, and build**

Run: `pnpm --filter @wcgw/vibe-check-core test && pnpm --filter @wcgw/vibe-check-core lint && pnpm --filter @wcgw/vibe-check-core build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/beacon/beaconClient.ts packages/core/src/beacon/__tests__/beaconClient.test.ts packages/core/src/engine.ts packages/core/src/scriptedEngine.ts packages/core/src/__tests__/engine.test.ts packages/core/src/__tests__/scriptedEngine.test.ts packages/core/src/index.ts
git commit -m "feat(core): dispatch browser issues to project agents"
```

---

### Task 7: Replace Clipboard Theater with Truthful Widget Delivery

**Files:**
- Create: `packages/react/src/panels/AgentConnectionStatus.tsx`
- Create: `packages/react/src/panels/__tests__/AgentConnectionStatus.test.tsx`
- Modify: `packages/react/src/panels/AgentPanel.tsx`
- Create: `packages/react/src/panels/__tests__/AgentPanel.test.tsx`
- Modify: `packages/react/src/panels/AuditPanel.tsx`
- Modify: `packages/react/src/panels/AnnotationOverlay.tsx`
- Modify: `packages/react/src/panels/SettingsPanel.tsx`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`

**Interfaces:**
- Consumes: `BeaconStatus` and `VibeEngine.dispatchIssue`.
- Produces: truthful connection UI and independently labeled **Send to agent** / **Copy prompt** actions.

- [ ] **Step 1: Write failing connection-state component tests**

Cover unconfigured, hub offline, no agent, watching, busy, stale, and secondary conflict warning. Require `data-testid="vibe-check-agent-status"` and exact recovery instructions.

```tsx
render(<AgentConnectionStatus beaconUrl="http://127.0.0.1:4200" status={watchingStatus} mode="technical" />)
expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent connected')

render(<AgentConnectionStatus beaconUrl="http://127.0.0.1:4200" status={conflictedWatchingStatus} mode="technical" />)
expect(screen.getByText(/second agent was rejected/i)).toBeTruthy()
expect(screen.getByTestId('vibe-check-agent-status').textContent).toContain('Agent connected')
```

- [ ] **Step 2: Write failing AgentPanel interaction tests**

Assert that copy never calls `onMarkSent`; successful dispatch does; failed dispatch does not; send is disabled without a watcher; `sending`, `sent`, `agent not listening`, and `queue full` are visible.

- [ ] **Step 3: Run focused React tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- AgentConnectionStatus.test.tsx AgentPanel.test.tsx VibeCheck.test.tsx`

Expected: FAIL because the components and dispatch props are absent.

- [ ] **Step 4: Implement the connection component and dispatch handler**

In `VibeCheck.tsx`, pass `projectId` into `useVibeCheck` config and add:

```ts
const handleDispatch = useCallback(async (issue: VibeIssue) => {
  if (!engine) {
    return { ok: false, code: 'unconfigured', projectId: projectId ?? '', queueDepth: 0 } as const
  }
  const result = await engine.dispatchIssue(issue)
  if (result.ok) {
    markSent(issue.id)
    if (prefs.clearOnSend) updatePrefs({ annotationsVisible: false })
  }
  return result
}, [engine, markSent, prefs.clearOnSend, projectId, updatePrefs])
```

Pass the real `BeaconStatus`, `handleDispatch`, and send-enabled state to `AgentPanel`. Add `readonly projectId?: string` to `VibeCheckProps`.

- [ ] **Step 5: Separate send from copy everywhere**

In `AgentPanel`, render a normal button labeled **Send to agent** and a `CopyButton` labeled **Copy prompt**. Keep per-issue dispatch state in a `ReadonlyMap<string, DispatchResultCode | 'sending'>`. Remove `onMarkSentBatch`; “copy all” remains clipboard-only. In `AuditPanel` and `AnnotationOverlay`, remove the `onMarkSent` call after clipboard success and use the label **Copy prompt**.

- [ ] **Step 6: Replace Settings' tri-state with the shared status component**

Remove the old `deriveConnectionState`. Render `AgentConnectionStatus` in Settings so all warning and recovery text has one implementation.

- [ ] **Step 7: Run React tests, size budget, and lint**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint && pnpm --filter @wcgw/vibe-check size`

Expected: PASS and eager main bundle remains below 45 KB gzip.

- [ ] **Step 8: Commit**

```bash
git add packages/react/src/panels/AgentConnectionStatus.tsx packages/react/src/panels/__tests__/AgentConnectionStatus.test.tsx packages/react/src/panels/AgentPanel.tsx packages/react/src/panels/__tests__/AgentPanel.test.tsx packages/react/src/panels/AuditPanel.tsx packages/react/src/panels/AnnotationOverlay.tsx packages/react/src/panels/SettingsPanel.tsx packages/react/src/VibeCheck.tsx packages/react/src/__tests__/VibeCheck.test.tsx
git commit -m "feat(react): send detected issues to a watching agent"
```

---

### Task 8: Correct the Installation and Public Product Story

**Files:**
- Modify: `README.md`
- Modify: `packages/react/README.md`
- Modify: `packages/mcp/README.md`
- Modify: `demo/README.md`
- Modify: `skills/vibe-check/SKILL.md`
- Modify: `apps/web/content/docs/quickstart.mdx`
- Modify: `apps/web/content/docs/ai-agents/overview.mdx`
- Modify: `apps/web/content/docs/ai-agents/claude-code.mdx`
- Modify: `apps/web/content/docs/reference/mcp-tools.mdx`
- Modify: `apps/web/content/docs/concepts/issue-lifecycle.mdx`
- Modify: `apps/web/content/docs/troubleshooting.mdx`
- Modify: `apps/web/components/landing/AgentRoundTrip.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: final CLI commands, tool names, argument names, and UI copy.
- Produces: one reproducible clean-install path with no duplicate hub process.

- [ ] **Step 1: Update the canonical quickstart first**

Use this order and commands:

```bash
pnpm add -D @wcgw/vibe-check
npx -y @wcgw/vibe-check-mcp hub
```

```tsx
<VibeCheck
  beaconUrl="http://127.0.0.1:4200"
/>
```

Explain that browser origin is the default project ID and show `projectId="my-app"` only as the override for unstable proxy/origin setups.

Agent config must spawn only the bridge:

```json
{
  "mcpServers": {
    "vibe-check": {
      "command": "npx",
      "args": ["-y", "@wcgw/vibe-check-mcp", "connect"]
    }
  }
}
```

Explicitly tell the user to start their app dev server, open it in a browser, ask the agent to call `list_projects` then `watch_for_issue`, wait for green **Agent connected**, and click **Send to agent**.

- [ ] **Step 2: Propagate the same contract to package and site docs**

Document the nine tools, exclusive leases, project ambiguity response, second-agent warning, hub/bridge roles, health signature, queue limit, heartbeat expiry, and recovery commands. Never instruct users to run the hub both manually and through agent configuration. Replace the old global `/api/stream` documentation with the project-scoped hub/status and bridge wait APIs; do not leave a documented endpoint that the new hub no longer serves.

- [ ] **Step 3: Make the marketing example API-accurate**

Change the illustrative transcript to a real `dom-bloat` issue and use `issue_id`:

```text
watch_for_issue({ project_id: 'http://localhost:5173' })
get_fix_suggestions({ project_id: 'http://localhost:5173', issue_id: 'dom-bloat-1' })
resolve_issue({ project_id: 'http://localhost:5173', issue_id: 'dom-bloat-1' })
```

Label the terminal “illustrative transcript.” State beside the marketing widget that it measures the page locally and is intentionally not connected to a visitor's MCP hub.

- [ ] **Step 4: Validate documentation and site build**

Run: `pnpm --filter web lint && pnpm --filter web build && pnpm gen:docs && git diff --check`

Expected: PASS; generated detector references remain clean after regeneration.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/react/README.md packages/mcp/README.md demo/README.md skills/vibe-check/SKILL.md apps/web/content/docs apps/web/components/landing/AgentRoundTrip.tsx apps/web/app/page.tsx
git commit -m "docs: publish the real MCP installation workflow"
```

---

### Task 9: Build the Packaged Multi-Project Playwright Test

**Files:**
- Create: `e2e/mcp-roundtrip/package.json`
- Create: `e2e/mcp-roundtrip/playwright.config.ts`
- Create: `e2e/mcp-roundtrip/fixtures/index.html`
- Create: `e2e/mcp-roundtrip/fixtures/src/main.tsx`
- Create: `e2e/mcp-roundtrip/fixtures/src/App.tsx`
- Create: `e2e/mcp-roundtrip/fixtures/vite.config.ts`
- Create: `e2e/mcp-roundtrip/helpers/processes.ts`
- Create: `e2e/mcp-roundtrip/helpers/installFixture.ts`
- Create: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: packed core, React, and MCP tarballs; hub/bridge CLI; real widget DOM.
- Produces: `pnpm test:e2e:mcp` and retained diagnostics under `test-results/`.

- [ ] **Step 1: Add the E2E workspace and dependencies**

Add `e2e/*` to `pnpm-workspace.yaml`. Give the E2E package private dev dependencies on `@playwright/test`, `@modelcontextprotocol/sdk`, React, React DOM, Vite, and `@vitejs/plugin-react`. Add root script:

```json
"test:e2e:mcp": "pnpm --filter @wcgw/vibe-check-mcp-roundtrip test"
```

- [ ] **Step 2: Create the deterministic real-issue fixture**

`App.tsx` must render 1,600 actual elements before mounting VibeCheck:

```tsx
import { VibeCheck } from '@wcgw/vibe-check'

export const App = () => (
  <main>
    <h1>VibeCheck MCP fixture</h1>
    <div id="bloated-tree">
      {Array.from({ length: 1600 }, (_, index) => <span key={index}>node {index}</span>)}
    </div>
    <VibeCheck
      beaconUrl={import.meta.env.VITE_HUB_URL}
      projectId={window.location.origin}
    />
  </main>
)
```

This crosses the real `dom-bloat` error threshold during engine startup; do not inject a fake engine or snapshot.

- [ ] **Step 3: Implement clean tarball installation**

`installFixture.ts` must run package builds, pack core/React/MCP to a temporary tarball directory, copy the fixture twice, write each temporary `package.json` with `file:` tarball dependencies, and run `pnpm install --ignore-workspace --frozen-lockfile=false`. Return absolute app directories and tarball paths. Always remove the temporary root in `finally`.

- [ ] **Step 4: Implement process orchestration with condition-based readiness**

`processes.ts` must allocate free loopback ports, spawn child processes without shell interpolation, capture stdout/stderr to files, poll hub health until it reports `service: vibe-check-hub`, poll each Vite URL until HTTP 200, and terminate children with SIGTERM followed by SIGKILL only after a 5-second grace period.

- [ ] **Step 5: Write the single-project dispatch E2E test**

Start hub, app A, and one SDK `Client` through a packed `connect` bridge. Open app A, wait for `dom-bloat`, open the Agent tab, call `watch_for_issue`, wait for `Agent connected`, click **Send to agent**, and assert:

```ts
expect(received.projectId).toBe(appAUrl)
expect(received.issue.detector).toBe('dom-bloat')
expect(received.issue.evidence.nodeCount).toBeGreaterThanOrEqual(1500)
expect(received.suggestion).toContain('DOM Bloat')
await expect(page.getByText('sent', { exact: true })).toBeVisible()
```

- [ ] **Step 6: Write the multi-project and conflict E2E test**

Start app A and B plus clients A, B, and C. A watches project A; B watches project B; C attempts A and receives `lease-conflict`. Assert widget A still says connected and shows the rejected-agent warning; widget B has no warning. Dispatch from both widgets and assert exact project isolation. Close A, wait no more than 15 seconds, let C acquire A, reload app A to create a fresh real detector issue, and dispatch that new A issue to C.

- [ ] **Step 7: Configure failure artifacts**

Use:

```ts
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results',
})
```

Attach hub, bridge, dev-server, and MCP transcript files with `testInfo.attach` on failure.

- [ ] **Step 8: Run the packaged E2E test**

Run: `pnpm exec playwright install chromium && pnpm test:e2e:mcp`

Expected: PASS for clean install, real detector, real click, real MCP delivery, project isolation, conflict warning, lease release, and reacquisition.

- [ ] **Step 9: Commit**

```bash
git add e2e/mcp-roundtrip package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "test(e2e): prove packaged widget-to-agent delivery"
```

---

### Task 10: Add CI and Perform Release Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CHANGELOG.md`
- Modify: `packages/mcp/package.json`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: Node 20 CI gate and release evidence for `0.2.0`.

- [ ] **Step 1: Add a Node 20 CI workflow**

The workflow must install with `pnpm install --frozen-lockfile`, run package and app type-checks, all unit tests, all builds, the React size budget, install Chromium with dependencies, and run `pnpm test:e2e:mcp`. Upload `e2e/mcp-roundtrip/test-results` when E2E fails.

```yaml
- name: Install Chromium
  run: pnpm exec playwright install --with-deps chromium

- name: Packaged MCP round-trip
  run: pnpm test:e2e:mcp

- name: Upload E2E diagnostics
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: mcp-roundtrip-diagnostics
    path: e2e/mcp-roundtrip/test-results
```

- [ ] **Step 2: Add the release entry and package smoke checks**

Update the `0.2.0` changelog with hub/bridge roles, project isolation, exclusive lease warnings, real widget dispatch, and packaged E2E proof. Run `pnpm publish:dry` and inspect each tarball manifest for `dist`, README, license, executable, and no workspace-only runtime dependency.

- [ ] **Step 3: Run the complete verification sequence**

Run sequentially:

```bash
pnpm lint
pnpm --filter web lint
pnpm --filter @wcgw/vibe-check-scan-worker lint
pnpm test
pnpm build
pnpm --filter @wcgw/vibe-check size
pnpm test:e2e:mcp
pnpm publish:dry
git diff --check
git status --short
```

Expected: every command passes; status contains only intentionally untracked user files plus implementation changes already committed.

- [ ] **Step 4: Perform one manual clean-room walkthrough**

In a temporary directory, follow the published quickstart verbatim. Start the hub, start the app dev server, connect a real supported agent client using the documented `connect` command, call `watch_for_issue`, click **Send to agent**, and record the received issue ID in release notes. Then run a second project concurrently and confirm both widgets route to their owners.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml CHANGELOG.md packages/mcp/package.json
git commit -m "ci: gate release on MCP round-trip proof"
```

---

## Final Acceptance Checklist

- [ ] A clean local app installs only published-style tarballs and renders the real widget.
- [ ] The app's dev server and the hub are distinct, documented processes.
- [ ] The agent bridge never binds the browser port.
- [ ] One agent watches one project; a second is rejected without replacing it.
- [ ] Two projects and two agents operate concurrently without cross-talk.
- [ ] Widget states are truthful for offline, no-agent, watching, busy, stale, and conflict conditions.
- [ ] Clipboard actions do not mark issues sent.
- [ ] **Send to agent** completes a pending MCP call with the exact detected issue.
- [ ] Lease release and 15-second expiry both permit a new watcher.
- [ ] The marketing demo is explicitly illustrative and API-accurate.
- [ ] Unit, type-check, build, size, packaged E2E, and publish-dry-run checks all pass on Node 20.
