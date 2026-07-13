# Durable Issue Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each dispatched issue into a project-scoped, persisted MCP workflow that browser evidence can verify and reopen when it regresses.

**Architecture:** Add a shared page-aware stable issue key, then keep workflow transitions in a pure immutable MCP reducer. The hub is the online source of truth, persists versioned workflow data beneath the registered project root, and exposes a browser-safe read model cached by React. MCP dequeue/acknowledge/resolve calls drive Sent → Agent working → Verifying, while later same-page snapshots confirm Fixed or Regressed.

**Tech Stack:** TypeScript strict mode, zero-dependency protocol/core, Node HTTP/filesystem, Zod, MCP SDK, React, localStorage, Vitest, Playwright.

## Global Constraints

- One agent session may own one project; one project may have one healthy watcher.
- Browser payloads never contain local filesystem paths.
- Core retains zero runtime dependencies.
- All state updates are immutable.
- Fixes require two newer same-page snapshots without the stable issue key.
- A failed verification creates one event and returns the record to Agent working.
- A fixed issue that returns reopens the same record and increments occurrence/regression counts.
- Browser-facing endpoints expose no registry paths, session IDs, or raw local configuration.
- Operational state is capped, versioned, atomically persisted, and ignored by git.

---

## File Map

- Create `packages/protocol/src/issueIdentity.ts` — URL normalization and detector-specific stable keys.
- Create `packages/protocol/src/__tests__/issueIdentity.test.ts` — identity stability tests.
- Modify `packages/protocol/src/index.ts` — page URL and workflow wire types.
- Modify `packages/core/src/beacon/beaconClient.ts` and tests — send page URL with snapshots/dispatch.
- Modify `packages/mcp/src/schema.ts` and tests — validate new wire fields.
- Create `packages/mcp/src/workflow.ts` and `packages/mcp/src/__tests__/workflow.test.ts` — pure workflow reducer.
- Modify `packages/mcp/src/hubStore.ts` and tests — integrate workflow with dispatch/dequeue/snapshots.
- Modify `packages/mcp/src/hubServer.ts`, `hubClient.ts`, `mcpServer.ts` and tests — browser progress/verify APIs and MCP semantics.
- Create `packages/mcp/src/projectRegistry.ts` and tests — project ID to root registry.
- Create `packages/mcp/src/persistence.ts` and tests — versioned atomic workflow persistence.
- Modify `packages/mcp/src/setup.ts`, `cli.ts`, `main.ts`, `index.ts` and tests — setup/register wiring.
- Create `packages/react/src/store/workflowCache.ts` and tests — project cache.
- Create `packages/react/src/hooks/useIssueWorkflow.ts` and tests — online workflow polling with stale cache fallback.
- Modify `packages/react/src/store/issueStore.ts` — local-only fallback keyed per project.
- Create `packages/react/src/panels/IssueProgress.tsx` and tests — phase badge and timeline.
- Modify `packages/react/src/panels/AgentPanel.tsx`, `IssueActions.tsx`, `VibeCheck.tsx` and tests — in-progress/fixed/regressed UI.
- Modify `e2e/mcp-roundtrip/*` — real persisted workflow and restart coverage.

### Task 1: Stable page-aware issue identity

**Files:**
- Create: `packages/protocol/src/issueIdentity.ts`
- Create: `packages/protocol/src/__tests__/issueIdentity.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/core/src/beacon/beaconClient.ts`
- Modify: `packages/core/src/beacon/__tests__/beaconClient.test.ts`
- Modify: `packages/mcp/src/schema.ts`
- Modify: `packages/mcp/src/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `normalizePageUrl(input: string): string`
- Produces: `getStableIssueKey(projectId: string, pageUrl: string, issue: VibeIssue): string`
- Extends: `ProjectSnapshotEnvelope.pageUrl: string`
- Extends: `DispatchIssueRequest.pageUrl: string`
- Extends: `QueuedIssue.issueKey: string`

- [ ] **Step 1: Write failing identity tests**

```ts
import { describe, expect, it } from 'vitest'
import { getStableIssueKey, normalizePageUrl, type VibeIssue } from '../index.js'

const issue = (evidence: Record<string, unknown>, title = 'Missing title'): VibeIssue => ({
  id: `seo-${Math.random()}`,
  detector: 'seo',
  severity: 'warning',
  title,
  description: '',
  evidence,
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
})

it('ignores query, hash, occurrence id, title, and changing measurements', () => {
  const first = getStableIssueKey('shop', 'http://localhost:3000/pricing?a=1#top', issue({ check: 'h1-multiple', detail: '2 found' }))
  const second = getStableIssueKey('shop', 'http://localhost:3000/pricing?a=2#bottom', issue({ check: 'h1-multiple', detail: '5 found' }, 'Several headings'))
  expect(first).toBe(second)
})

it('keeps projects, pages, checks, methods, and resource URLs distinct', () => {
  expect(normalizePageUrl('http://localhost:3000/pricing?q=1#x')).toBe('http://localhost:3000/pricing')
  expect(getStableIssueKey('shop', 'http://localhost/a', issue({ check: 'h1-missing' })))
    .not.toBe(getStableIssueKey('shop', 'http://localhost/b', issue({ check: 'h1-missing' })))
})
```

- [ ] **Step 2: Run protocol tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-protocol test -- src/__tests__/issueIdentity.test.ts`

Expected: FAIL because the identity helpers are not exported.

- [ ] **Step 3: Implement canonical identity rules**

```ts
const evidenceString = (issue: VibeIssue, key: string): string => {
  const value = issue.evidence[key]
  return typeof value === 'string' ? value : ''
}

const detectorIdentity = (issue: VibeIssue): string => {
  if (issue.detector === 'seo' || issue.detector === 'aeo' || issue.detector === 'web-essentials') {
    return evidenceString(issue, 'check')
  }
  if (issue.detector === 'duplicate-requests') {
    return `${evidenceString(issue, 'method').toUpperCase()}:${evidenceString(issue, 'url')}`
  }
  if (issue.detector === 'unoptimized-images' || issue.detector === 'large-images') {
    return evidenceString(issue, 'src')
  }
  if (issue.detector === 'resource-bloat') return evidenceString(issue, 'url')
  if (issue.detector === 'long-task-attribution') return evidenceString(issue, 'sourceURL')
  if (issue.detector === 'heavy-library') return evidenceString(issue, 'packageName')
  if (issue.detector === 'console-spam') return evidenceString(issue, 'method')
  return issue.detector
}

export const normalizePageUrl = (input: string): string => {
  try {
    const url = new URL(input)
    return `${url.origin}${url.pathname}`
  } catch {
    return input.split(/[?#]/, 1)[0] ?? input
  }
}

export const getStableIssueKey = (projectId: string, pageUrl: string, issue: VibeIssue): string =>
  [projectId, normalizePageUrl(pageUrl), issue.detector, detectorIdentity(issue)]
    .map(encodeURIComponent)
    .join('|')
```

Export both helpers from `packages/protocol/src/index.ts`. Add `pageUrl` to both browser request types and `issueKey` to `QueuedIssue`. Set page URL from `window.location.href` in the beacon envelope and dispatch request. Update Zod schemas to require bounded `pageUrl`.

```ts
export interface ProjectSnapshotEnvelope {
  readonly projectId: string
  readonly instanceId: string
  readonly origin: string
  readonly pageUrl: string
  readonly title: string
  readonly snapshot: VibeSnapshot
}

export interface DispatchIssueRequest {
  readonly projectId: string
  readonly instanceId: string
  readonly pageUrl: string
  readonly issue: VibeIssue
}

export interface QueuedIssue {
  readonly projectId: string
  readonly issueKey: string
  readonly issue: VibeIssue
  readonly snapshot: VibeSnapshot
  readonly dispatchedAt: number
}
```

```ts
const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
// Include pageUrl in BeaconClient.envelope() and dispatchIssue() request.

export const projectSnapshotEnvelopeSchema = z.object({
  projectId: idSchema,
  instanceId: idSchema,
  origin: boundedString,
  pageUrl: boundedString,
  title: boundedString,
  snapshot: snapshotSchema,
})
```

- [ ] **Step 4: Run protocol, core beacon, and MCP schema tests**

Run: `pnpm --filter @wcgw/vibe-check-protocol test && pnpm --filter @wcgw/vibe-check-core test -- src/beacon/__tests__/beaconClient.test.ts && pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/schema.test.ts`

Expected: all focused suites PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src packages/core/src/beacon packages/mcp/src/schema.ts packages/mcp/src/__tests__/schema.test.ts
git commit -m "feat: add stable page-aware issue identity"
```

### Task 2: Pure workflow reducer

**Files:**
- Create: `packages/mcp/src/workflow.ts`
- Create: `packages/mcp/src/__tests__/workflow.test.ts`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Produces: `IssuePhase`, `IssueWorkflowEvent`, `TrackedProjectIssue`, `ProjectWorkflow`
- Produces: `recordWorkflowSnapshot`, `markWorkflowDispatched`, `markWorkflowWorking`, `requestWorkflowVerification`

- [ ] **Step 1: Define workflow types and write transition tests**

```ts
export type IssuePhase = 'detected' | 'sent' | 'working' | 'verifying' | 'fixed' | 'regressed'

export interface IssueWorkflowEvent {
  readonly type: 'detected' | 'sent' | 'working' | 'verification-requested' | 'verification-failed' | 'fixed' | 'regressed'
  readonly at: number
  readonly occurrence: number
}

export interface TrackedProjectIssue {
  readonly issueKey: string
  readonly pageUrl: string
  readonly issue: VibeIssue
  readonly phase: IssuePhase
  readonly occurrenceCount: number
  readonly regressionCount: number
  readonly verificationMisses: number
  readonly firstSeenAt: number
  readonly lastSeenAt: number
  readonly events: readonly IssueWorkflowEvent[]
}
```

```ts
it('moves through work, evidence verification, and regression idempotently', () => {
  let workflow = createProjectWorkflow('project-a')
  workflow = recordWorkflowSnapshot(workflow, envelope([issue('first')], '/pricing', 1), 1)
  const key = workflow.issues[0]!.issueKey
  workflow = markWorkflowDispatched(workflow, key, 2)
  workflow = markWorkflowWorking(workflow, 'first', 3)
  expect(markWorkflowWorking(workflow, 'first', 4)).toEqual(workflow)
  workflow = requestWorkflowVerification(workflow, 'first', 5)
  workflow = recordWorkflowSnapshot(workflow, envelope([issue('still-there')], '/pricing', 6), 6)
  expect(workflow.issues[0]?.phase).toBe('working')
  expect(workflow.issues[0]?.events.filter((event) => event.type === 'verification-failed')).toHaveLength(1)

  workflow = requestWorkflowVerification(workflow, 'still-there', 7)
  workflow = recordWorkflowSnapshot(workflow, envelope([], '/other', 8), 8)
  expect(workflow.issues[0]?.phase).toBe('verifying')
  workflow = recordWorkflowSnapshot(workflow, envelope([], '/pricing', 9), 9)
  workflow = recordWorkflowSnapshot(workflow, envelope([], '/pricing', 10), 10)
  expect(workflow.issues[0]?.phase).toBe('fixed')

  workflow = recordWorkflowSnapshot(workflow, envelope([issue('returned')], '/pricing', 11), 11)
  expect(workflow.issues[0]).toMatchObject({
    phase: 'regressed', occurrenceCount: 2, regressionCount: 1,
  })
})

it('caps transient history without evicting actionable or fixed baselines', () => {
  const protectedIssues = [tracked({ phase: 'regressed' }), tracked({ phase: 'fixed' })]
  const transient = Array.from({ length: 220 }, (_, index) =>
    tracked({ issueKey: `old-${index}`, phase: 'detected', lastSeenAt: index }))
  const compacted = compactWorkflowIssues([...protectedIssues, ...transient])
  expect(compacted).toHaveLength(200)
  expect(compacted).toEqual(expect.arrayContaining(protectedIssues))
  expect(compacted.some((item) => item.issueKey === 'old-0')).toBe(false)
})
```

- [ ] **Step 2: Run the reducer test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/workflow.test.ts`

Expected: FAIL because `workflow.ts` does not exist.

- [ ] **Step 3: Implement immutable transitions**

```ts
export const createProjectWorkflow = (projectId: string): ProjectWorkflow => ({
  schemaVersion: 1,
  projectId,
  revision: 0,
  issues: [],
})

const appendEvent = (
  tracked: TrackedProjectIssue,
  event: IssueWorkflowEvent,
): TrackedProjectIssue => ({
  ...tracked,
  events: [...tracked.events, event].slice(-50),
})

export const requestWorkflowVerification = (
  workflow: ProjectWorkflow,
  issueId: string,
  now: number,
): ProjectWorkflow => replaceByOccurrenceId(workflow, issueId, (tracked) => appendEvent({
  ...tracked,
  phase: 'verifying',
  verificationMisses: 0,
}, { type: 'verification-requested', at: now, occurrence: tracked.occurrenceCount }))
```

`recordWorkflowSnapshot` compares only records whose normalized `pageUrl` matches the envelope. A verifying record present in the newer snapshot emits one failure and becomes working. A verifying record absent twice becomes fixed. A fixed record present becomes regressed and increments both counts. All no-op transitions return the original object.

```ts
export const compactWorkflowIssues = (
  issues: readonly TrackedProjectIssue[],
): readonly TrackedProjectIssue[] => {
  if (issues.length <= 200) return issues
  const protectedIssues = issues
    .filter((issue) => issue.phase !== 'detected')
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  const transient = issues
    .filter((issue) => issue.phase === 'detected')
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  return [...protectedIssues, ...transient].slice(0, 200)
}
```

- [ ] **Step 4: Run reducer and protocol tests**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/workflow.test.ts && pnpm --filter @wcgw/vibe-check-protocol test`

Expected: reducer and protocol suites PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/index.ts packages/mcp/src/workflow.ts packages/mcp/src/__tests__/workflow.test.ts
git commit -m "feat: model issue progress and regressions"
```

### Task 3: Hub, browser API, and MCP integration

**Files:**
- Modify: `packages/mcp/src/hubStore.ts`
- Modify: `packages/mcp/src/hubServer.ts`
- Modify: `packages/mcp/src/hubClient.ts`
- Modify: `packages/mcp/src/mcpServer.ts`
- Modify: `packages/mcp/src/__tests__/hubStore.test.ts`
- Modify: `packages/mcp/src/__tests__/hubServer.test.ts`
- Modify: `packages/mcp/src/__tests__/hubClient.test.ts`
- Modify: `packages/mcp/src/__tests__/mcpServer.test.ts`

**Interfaces:**
- Consumes workflow reducer from Task 2.
- Produces browser `GET /api/projects/:projectId/workflow`.
- Produces browser `POST /api/projects/:projectId/issues/:issueId/verify`.
- Produces `HubClient.getWorkflow()` and `HubClient.requestVerification()`.

- [ ] **Step 1: Write failing hub round-trip tests**

Add a server test that publishes an issue, dispatches it, dequeues it, asserts `working`, calls resolve, publishes two newer empty same-page snapshots, and asserts `fixed`. Publish the same stable issue under a new ID and assert `regressed`, occurrence `2`, and regression `1`.

```ts
it('tracks a real issue through verified fix and regression', async () => {
  const base = await start()
  const project = encodeURIComponent('project-a')
  await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [makeIssue('first')], '/pricing', 1))
  await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })
  await post(`${base}/api/projects/${project}/dispatch`, {
    projectId: 'project-a', instanceId: 'browser-a', pageUrl: 'http://project-a/pricing', issue: makeIssue('first'),
  })
  await post(`${base}/internal/projects/${project}/issues/next`, { sessionId: 'agent-a', timeoutSeconds: 1 })
  expect((await json(`${base}/api/projects/${project}/workflow`)).body)
    .toMatchObject({ issues: [{ phase: 'working' }] })
  await post(`${base}/internal/projects/${project}/issues/first/resolve`, {})
  await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [], '/pricing', 2))
  await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [], '/pricing', 3))
  expect((await json(`${base}/api/projects/${project}/workflow`)).body)
    .toMatchObject({ issues: [{ phase: 'fixed' }] })
  await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [makeIssue('returned')], '/pricing', 4))
  expect((await json(`${base}/api/projects/${project}/workflow`)).body)
    .toMatchObject({ issues: [{ phase: 'regressed', occurrenceCount: 2, regressionCount: 1 }] })
})
```

- [ ] **Step 2: Run hub/MCP tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/hubStore.test.ts src/__tests__/hubServer.test.ts src/__tests__/hubClient.test.ts src/__tests__/mcpServer.test.ts`

Expected: FAIL because workflow endpoints and semantics do not exist.

- [ ] **Step 3: Integrate workflow into every mutation**

Add `workflow: ProjectWorkflow` to `HubProject`. In `recordSnapshot`, call `recordWorkflowSnapshot`. In successful dispatch, call `markWorkflowDispatched` before enqueue. In dequeue and acknowledge, call `markWorkflowWorking`. In resolve and browser verify, call `requestWorkflowVerification` rather than adding the ephemeral ID to a permanent filter set.

```ts
const nextWorkflow = recordWorkflowSnapshot(
  current?.workflow ?? createProjectWorkflow(envelope.projectId),
  envelope,
  now,
)

const dispatchedWorkflow = markWorkflowDispatched(project.workflow, issueKey, now)
const queue = [...project.queue, {
  projectId,
  issueKey,
  issue,
  snapshot: project.store.latestSnapshot,
  dispatchedAt: now,
}]

const workingProject = {
  ...project,
  workflow: markWorkflowWorking(project.workflow, issue.issue.id, now),
}
```

```ts
export interface HubClient {
  // existing methods
  getWorkflow(projectId: string): Promise<ProjectWorkflow | null>
  requestVerification(projectId: string, issueId: string): Promise<void>
}
```

Return the workflow on the browser-safe GET route with CORS headers. The internal issue lookup continues accepting occurrence IDs by resolving them through current snapshot, history, then workflow records.

```ts
if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'workflow') {
  const workflow = store.projects.get(parts[2] ?? '')?.workflow ?? null
  sendJson(res, workflow ? 200 : 404, workflow ?? { error: 'Project not found' }, true)
  return
}

if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
  && parts[3] === 'issues' && parts[4] && parts[5] === 'verify') {
  store = requestProjectVerification(store, parts[2] ?? '', parts[4], now())
  sendJson(res, 200, { verifying: true, projectId: parts[2], issueId: parts[4] }, true)
  return
}
```

- [ ] **Step 4: Run hub/MCP tests**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/hubStore.test.ts src/__tests__/hubServer.test.ts src/__tests__/hubClient.test.ts src/__tests__/mcpServer.test.ts`

Expected: focused MCP suites PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/hubStore.ts packages/mcp/src/hubServer.ts packages/mcp/src/hubClient.ts packages/mcp/src/mcpServer.ts packages/mcp/src/__tests__
git commit -m "feat: connect MCP actions to issue progress"
```

### Task 4: Project registration and atomic persistence

**Files:**
- Create: `packages/mcp/src/projectRegistry.ts`
- Create: `packages/mcp/src/persistence.ts`
- Create: `packages/mcp/src/__tests__/projectRegistry.test.ts`
- Create: `packages/mcp/src/__tests__/persistence.test.ts`
- Modify: `packages/mcp/src/setup.ts`
- Modify: `packages/mcp/src/cli.ts`
- Modify: `packages/mcp/src/main.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/src/hubServer.ts`
- Modify: `packages/mcp/src/__tests__/setup.test.ts`
- Modify: `packages/mcp/src/__tests__/main.test.ts`

**Interfaces:**
- Produces: `ProjectRegistryEntry`, `readProjectRegistry`, `registerProjectRoot`, `resolveProjectRoot`.
- Produces: `readPersistedWorkflow`, `writePersistedWorkflow`.
- Extends `HubServerOptions` with `registryPath?: string` and `onPersistenceWarning?: (message: string) => void`.

- [ ] **Step 1: Write failing registry/persistence tests**

```ts
it('registers unique project roots and rejects collisions', async () => {
  const path = join(root, 'projects.json')
  await registerProjectRoot(path, 'storefront', join(root, 'a'))
  await expect(registerProjectRoot(path, 'storefront', join(root, 'b')))
    .rejects.toThrow('already registered')
})

it('round-trips sets/maps through versioned atomic state and backs up corruption', async () => {
  const statePath = join(root, '.vibecheck/state.json')
  await writePersistedWorkflow(statePath, workflow)
  await expect(readPersistedWorkflow(statePath, 'storefront')).resolves.toEqual(workflow)
  await writeFile(statePath, '{broken')
  const recovered = await readPersistedWorkflow(statePath, 'storefront')
  expect(recovered).toEqual(createProjectWorkflow('storefront'))
  expect((await readdir(dirname(statePath))).some((name) => name.includes('.corrupt-'))).toBe(true)
})

it('keeps two project workflows isolated when they share one repository root', async () => {
  const statePath = join(root, '.vibecheck/state.json')
  await writePersistedWorkflow(statePath, workflowFor('storefront'))
  await writePersistedWorkflow(statePath, workflowFor('admin'))
  await expect(readPersistedWorkflow(statePath, 'storefront'))
    .resolves.toMatchObject({ projectId: 'storefront' })
  await expect(readPersistedWorkflow(statePath, 'admin'))
    .resolves.toMatchObject({ projectId: 'admin' })
})
```

- [ ] **Step 2: Run persistence tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/projectRegistry.test.ts src/__tests__/persistence.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement safe registry and persistence**

Use schema version `1`, `realpath` roots before comparison, `mkdir({ recursive: true })`, and temporary sibling file + `rename`. The default registry path is `join(homedir(), '.vibecheck/projects.json')`. The state path is `join(projectRoot, '.vibecheck/state.json')`. A corrupt or newer-schema file is renamed to `state.json.corrupt-<timestamp>` and reported through the warning callback.

```ts
export const writePersistedWorkflow = async (
  statePath: string,
  workflow: ProjectWorkflow,
): Promise<void> => {
  await mkdir(dirname(statePath), { recursive: true })
  const current = await readPersistedProjectState(statePath)
  const next: PersistedProjectState = {
    schemaVersion: 1,
    projects: { ...current.projects, [workflow.projectId]: workflow },
  }
  const temporary = join(dirname(statePath), `.state.${process.pid}.${Date.now()}.tmp`)
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`)
  await rename(temporary, statePath)
}

export const registerProjectRoot = async (
  registryPath: string,
  projectId: string,
  inputRoot: string,
): Promise<void> => {
  const root = await realpath(inputRoot)
  const registry = await readProjectRegistry(registryPath)
  const existing = registry.projects[projectId]
  if (existing && existing.root !== root) throw new Error(`Project "${projectId}" is already registered at ${existing.root}`)
  await writeProjectRegistry(registryPath, {
    schemaVersion: 1,
    projects: { ...registry.projects, [projectId]: { root } },
  })
}
```

Setup writes `.vibecheck/config.json`, adds only `.vibecheck/state.json` and `.vibecheck/*.tmp` to `.gitignore`, and updates the user registry. Add CLI role:

```ts
| { readonly role: 'register'; readonly projectId: string; readonly root: string }
```

with `vibe-check-mcp register --project <id> [--root <path>]`; default root is `process.cwd()`.

Extend the hub config with `registryPath`, defaulting to
`VIBE_CHECK_REGISTRY_PATH ?? join(homedir(), '.vibecheck/projects.json')`, and
pass it to `createHubServer`. This explicit environment override is used by
tests and advanced multi-workspace setups.

- [ ] **Step 4: Connect persistence to the hub and run tests**

On first snapshot for a registered project, load its workflow once before applying the snapshot. After workflow-changing mutations, schedule one debounced atomic write. `close()` flushes pending writes before resolving.

```ts
const ensureLoaded = async (projectId: string): Promise<void> => {
  if (loadedProjects.has(projectId)) return
  const root = await resolveProjectRoot(registryPath, projectId)
  if (root) store = restoreProjectWorkflow(store, projectId, await readPersistedWorkflow(
    join(root, '.vibecheck/state.json'), projectId,
  ))
  loadedProjects.add(projectId)
}

const schedulePersist = (projectId: string): void => {
  const current = pendingWrites.get(projectId)
  if (current) clearTimeout(current)
  pendingWrites.set(projectId, setTimeout(() => { void flushProject(projectId) }, 100))
}
```

Run: `pnpm --filter @wcgw/vibe-check-mcp test && pnpm --filter @wcgw/vibe-check-mcp lint`

Expected: all MCP tests and type-check PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src packages/mcp/README.md
git commit -m "feat: persist project issue workflow"
```

### Task 5: React workflow cache and progress UI

**Files:**
- Create: `packages/react/src/store/workflowCache.ts`
- Create: `packages/react/src/store/__tests__/workflowCache.test.ts`
- Create: `packages/react/src/hooks/useIssueWorkflow.ts`
- Create: `packages/react/src/hooks/__tests__/useIssueWorkflow.test.tsx`
- Create: `packages/react/src/panels/IssueProgress.tsx`
- Create: `packages/react/src/panels/__tests__/IssueProgress.test.tsx`
- Modify: `packages/react/src/store/issueStore.ts`
- Modify: `packages/react/src/hooks/useIssueStore.ts`
- Modify: `packages/react/src/panels/AgentPanel.tsx`
- Modify: `packages/react/src/panels/IssueActions.tsx`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: associated React tests.

**Interfaces:**
- Produces: `useIssueWorkflow({ beaconUrl, projectId, liveIssues }): { workflow, stale, requestVerification }`.
- Produces: `IssueProgress({ tracked, mode }): JSX.Element`.
- Produces project-local `hiddenFixedIssueKeys`; hiding fixed rows never mutates
  the hub workflow and a later regressed phase is always visible again.

- [ ] **Step 1: Write failing cache/hook/UI tests**

Test that each project uses `vibe-check:workflow:<encoded-project>`, online workflow overwrites the cache, failed fetch returns cached data with `stale: true`, the Agent tabs read `to fix / in progress / fixed`, and a regressed issue is actionable with occurrence/regression text.

```tsx
it('keeps project caches isolated and labels a failed refresh stale', async () => {
  writeWorkflowCache('project-a', workflow({ phase: 'working' }))
  writeWorkflowCache('project-b', workflow({ phase: 'fixed' }))
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
  const { result } = renderHook(() => useIssueWorkflow({
    beaconUrl: 'http://127.0.0.1:4200', projectId: 'project-a',
  }))
  await waitFor(() => expect(result.current.stale).toBe(true))
  expect(result.current.workflow?.issues[0]?.phase).toBe('working')
  expect(readWorkflowCache('project-b')?.issues[0]?.phase).toBe('fixed')
})

it('groups progress phases and keeps regressions actionable', () => {
  render(<AgentPanel {...props} tracked={[
    tracked({ phase: 'regressed', occurrenceCount: 2, regressionCount: 1 }),
    tracked({ phase: 'working' }),
    tracked({ phase: 'fixed' }),
  ]} />)
  expect(screen.getByRole('tab', { name: /to fix \(1\)/i })).toBeTruthy()
  expect(screen.getByRole('tab', { name: /in progress \(1\)/i })).toBeTruthy()
  expect(screen.getByRole('tab', { name: /fixed \(1\)/i })).toBeTruthy()
  expect(screen.getByText(/occurrence 2/i)).toBeTruthy()
  expect(screen.getByText(/regressed 1 time/i)).toBeTruthy()
})

it('hides fixed rows locally without deleting the regression baseline', () => {
  const store = createWorkflowCache('project-a')
  store.write(workflow({ issueKey: 'stable-a', phase: 'fixed' }))
  store.hideFixed(['stable-a'])
  expect(store.visibleIssues()).toEqual([])
  store.write(workflow({ issueKey: 'stable-a', phase: 'regressed' }))
  expect(store.visibleIssues()).toMatchObject([{ issueKey: 'stable-a', phase: 'regressed' }])
})
```

- [ ] **Step 2: Run focused React tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- src/store/__tests__/workflowCache.test.ts src/hooks/__tests__/useIssueWorkflow.test.tsx src/panels/__tests__/IssueProgress.test.tsx src/panels/__tests__/AgentPanel.test.tsx`

Expected: FAIL because the workflow cache/hook/UI do not exist.

- [ ] **Step 3: Implement polling and rendering**

```ts
export const workflowCacheKey = (projectId: string): string =>
  `vibe-check:workflow:${encodeURIComponent(projectId)}`

export const useIssueWorkflow = ({ beaconUrl, projectId }: UseIssueWorkflowOptions) => {
  const [workflow, setWorkflow] = useState(() => readWorkflowCache(projectId))
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (!beaconUrl || !projectId) return
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch(`${beaconUrl}/api/projects/${encodeURIComponent(projectId)}/workflow`)
        if (!response.ok) throw new Error(String(response.status))
        const next = await response.json() as ProjectWorkflow
        if (active) { writeWorkflowCache(projectId, next); setWorkflow(next); setStale(false) }
      } catch {
        if (active) setStale(true)
      }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 2_000)
    return () => { active = false; clearInterval(timer) }
  }, [beaconUrl, projectId])
  return { workflow, stale }
}
```

Map phases: detected/regressed → to fix; sent/working/verifying → in progress; fixed → fixed. Show a “last known” label when stale. Existing local issue storage becomes project-scoped fallback only when no configured hub workflow is available.

```ts
export type IssueQueue = 'active' | 'progress' | 'fixed'

export const queueForPhase = (phase: IssuePhase): IssueQueue => {
  if (phase === 'fixed') return 'fixed'
  if (phase === 'sent' || phase === 'working' || phase === 'verifying') return 'progress'
  return 'active'
}
```

```tsx
{stale && (
  <span role="status" style={{ color: T.yellow, fontSize: 12 }}>
    last known — hub offline
  </span>
)}
<IssueProgress tracked={tracked} mode={mode} />
```

- [ ] **Step 4: Run the React suite**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint && pnpm --filter @wcgw/vibe-check build`

Expected: all React tests, lint, and build PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src
git commit -m "feat: show durable agent issue progress"
```

### Task 6: Packed restart/regression showcase

**Files:**
- Modify: `e2e/mcp-roundtrip/helpers/installFixture.ts`
- Modify: `e2e/mcp-roundtrip/helpers/processes.ts`
- Modify: `e2e/mcp-roundtrip/fixtures/src/App.tsx`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`
- Modify: `packages/mcp/README.md`
- Modify: `packages/react/README.md`

**Interfaces:**
- Consumes all workflow functionality.
- Produces a deterministic real packed-package demo and regression test.
- Produces test helper `restartHub(): Promise<void>` that restarts the packed
  hub on the existing port and registry.

- [ ] **Step 1: Add a restartable packed E2E scenario**

Use temporary registered roots for app A/B. Dispatch app A’s DOM issue, receive it through the real MCP client, call `resolve_issue`, toggle fixture state so the bloated DOM disappears, wait for Fixed, restart the hub on the same port/root registry, and assert Fixed survives. Toggle bloat back on and assert Regressed with occurrence `2`; app B remains unchanged.

```ts
export interface InstalledFixture {
  readonly root: string
  readonly appA: string
  readonly appB: string
  readonly hubBin: string
  readonly registryPath: string
  cleanup(): Promise<void>
}

// beforeAll() writes this registry after ports and project IDs are known.
await writeFile(registryPath, JSON.stringify({
  schemaVersion: 1,
  projects: {
    [appAUrl]: { root: appA },
    [appBUrl]: { root: appB },
  },
}, null, 2))

const restartHub = async (): Promise<void> => {
  await hub.stop()
  hub = await startProcess(
    'hub-restarted', process.execPath, [fixture.hubBin, 'hub'], fixture.appA,
    { VIBE_CHECK_PORT: new URL(hubUrl).port, VIBE_CHECK_REGISTRY_PATH: fixture.registryPath },
    join(fixture.root, 'logs'),
  )
  processes.push(hub)
  await waitForJson(`${hubUrl}/api/health`, (value) =>
    (value as { service?: string }).service === 'vibe-check-hub')
}

test('persists a verified fix and reopens its regression', async ({ page }) => {
  const agent = await connectClient('workflow-agent')
  await openAgentIssue(page, appAUrl)
  const received = watch(agent.client, appAUrl)
  await page.getByTestId(/vibe-check-send-/).click()
  const sent = payload(await received)
  if (!sent.issue?.id) throw new Error('Agent did not receive an issue ID')
  await agent.client.callTool({
    name: 'resolve_issue',
    arguments: { project_id: appAUrl, issue_id: sent.issue.id },
  })
  await page.getByRole('button', { name: 'Apply fix' }).click()
  await expect(page.getByRole('tab', { name: /fixed \(1\)/i })).toBeVisible()
  await restartHub()
  await page.reload()
  await expect(page.getByRole('tab', { name: /fixed \(1\)/i })).toBeVisible()
  await page.getByRole('button', { name: 'Reintroduce regression' }).click()
  await expect(page.getByText(/occurrence 2/i)).toBeVisible()
  await expect(page.getByText(/regressed 1 time/i)).toBeVisible()
  await agent.close()
})
```

- [ ] **Step 2: Run the scenario and verify behavior**

Run: `pnpm test:e2e:mcp -- --grep "persists a verified fix and reopens its regression"`

Expected: 1 Playwright test PASS using packed tarballs.

- [ ] **Step 3: Extend the recording shell**

Add deterministic controls labelled `Introduce issue`, `Apply fix`, and `Reintroduce regression`, plus a receipt panel showing Sent, Agent working, Verifying, Fixed, and Regressed transitions from the real workflow endpoint.

```tsx
const [bloated, setBloated] = useState(true)

<button type="button" onClick={() => setBloated(true)}>Introduce issue</button>
<button type="button" onClick={() => setBloated(false)}>Apply fix</button>
<button type="button" onClick={() => setBloated(true)}>Reintroduce regression</button>
{bloated && (
  <div id="bloated-tree" aria-hidden="true">
    {Array.from({ length: 1600 }, (_, index) => <span key={index}>node {index}</span>)}
  </div>
)}
```

- [ ] **Step 4: Run complete verification**

Run: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e:mcp`

Expected: all unit/component/tooling suites PASS, all packages type-check and build, and all packed MCP scenarios PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/mcp-roundtrip packages/mcp/README.md packages/react/README.md
git commit -m "test: demonstrate persisted issue regressions"
```
