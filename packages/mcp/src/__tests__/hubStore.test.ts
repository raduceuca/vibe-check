import { describe, expect, it } from 'vitest'
import {
  MAX_DISPATCH_QUEUE,
  acquireLease,
  acknowledgeProjectIssue,
  createHubStore,
  dequeueIssue,
  dispatchIssue,
  findProjectIssue,
  getActiveIssues,
  getProjectStatus,
  heartbeatLease,
  listActiveProjects,
  markLeaseBusy,
  markLeaseWatching,
  recordSnapshot,
  releaseLease,
  resolveProjectIssue,
} from '../hubStore.js'
import type { ProjectSnapshotEnvelope, VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (id = 'dom-1'): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: `DOM issue ${id}`,
  description: 'Too many nodes',
  evidence: { nodeCount: 900 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const makeSnapshot = (issues: readonly VibeIssue[] = []): VibeSnapshot => ({
  timestamp: 1,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: {
    totalTransferKB: 0,
    jsTransferKB: 0,
    cssTransferKB: 0,
    imageTransferKB: 0,
    fontTransferKB: 0,
    resourceCount: 0,
    largeResources: [],
  },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues,
  domNodeCount: 900,
})

const makeEnvelope = (
  projectId: string,
  instanceId: string,
  issues: readonly VibeIssue[] = [],
): ProjectSnapshotEnvelope => ({
  projectId,
  instanceId,
  origin: projectId,
  title: `Fixture ${projectId}`,
  snapshot: makeSnapshot(issues),
})

const withProject = (
  projectId = 'project-a',
  issue = makeIssue(),
  now = 1_000,
) => recordSnapshot(createHubStore(), makeEnvelope(projectId, 'browser-a', [issue]), now)

describe('hubStore', () => {
  it('keeps projects isolated and rejects a second watcher', () => {
    let hub = createHubStore()
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'a', [makeIssue('a-1')]), 1_000)
    hub = recordSnapshot(hub, makeEnvelope('project-b', 'b', [makeIssue('b-1')]), 1_000)

    const first = acquireLease(hub, 'project-a', 'agent-a', 2_000)
    expect(first.result).toEqual({ ok: true, projectId: 'project-a', expiresAt: 17_000 })

    const conflict = acquireLease(first.store, 'project-a', 'agent-b', 3_000)
    expect(conflict.result).toEqual({ ok: false, code: 'lease-conflict', projectId: 'project-a' })
    expect(getProjectStatus(conflict.store, 'project-a', 3_000)?.conflictAt).toBe(3_000)
    expect(getProjectStatus(conflict.store, 'project-a', 3_000)?.state).toBe('watching')
    expect(getProjectStatus(conflict.store, 'project-b', 3_000)?.state).toBe('no-agent')
    expect(getActiveIssues(conflict.store, 'project-a').map((issue) => issue.id)).toEqual(['a-1'])
    expect(getActiveIssues(conflict.store, 'project-b').map((issue) => issue.id)).toEqual(['b-1'])
  })

  it('allows one project lease per agent session', () => {
    let hub = createHubStore()
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'a'), 1_000)
    hub = recordSnapshot(hub, makeEnvelope('project-b', 'b'), 1_000)
    hub = acquireLease(hub, 'project-a', 'agent-a', 2_000).store

    const second = acquireLease(hub, 'project-b', 'agent-a', 2_100)
    expect(second.result).toEqual({
      ok: false,
      code: 'session-already-watching',
      projectId: 'project-a',
    })

    const released = releaseLease(second.store, 'project-a', 'agent-a')
    expect(acquireLease(released, 'project-b', 'agent-a', 2_200).result.ok).toBe(true)
  })

  it('marks a missing heartbeat stale at 10s and expires it at 15s', () => {
    const claimed = acquireLease(withProject(), 'project-a', 'agent-a', 1_000).store

    expect(getProjectStatus(claimed, 'project-a', 10_999)?.state).toBe('watching')
    expect(getProjectStatus(claimed, 'project-a', 11_000)?.state).toBe('stale')
    expect(getProjectStatus(claimed, 'project-a', 16_000)?.state).toBe('no-agent')

    const renewed = heartbeatLease(claimed, 'project-a', 'agent-a', 10_000)
    expect(renewed.result).toEqual({ ok: true, projectId: 'project-a', expiresAt: 25_000 })
    expect(getProjectStatus(renewed.store, 'project-a', 19_999)?.state).toBe('watching')
  })

  it('tracks watching and busy independently of queue depth', () => {
    let hub = acquireLease(withProject(), 'project-a', 'agent-a', 2_000).store
    hub = markLeaseBusy(hub, 'project-a', 'agent-a')
    expect(getProjectStatus(hub, 'project-a', 2_100)?.state).toBe('busy')
    hub = markLeaseWatching(hub, 'project-a', 'agent-a')
    expect(getProjectStatus(hub, 'project-a', 2_100)?.state).toBe('watching')
  })

  it('queues at most ten issues and preserves FIFO dispatch context', () => {
    let hub = acquireLease(withProject(), 'project-a', 'agent-a', 2_000).store

    for (let index = 0; index < MAX_DISPATCH_QUEUE; index += 1) {
      const dispatched = dispatchIssue(hub, 'project-a', makeIssue(`issue-${index}`), 3_000 + index)
      expect(dispatched.result.ok).toBe(true)
      hub = dispatched.store
    }

    const overflow = dispatchIssue(hub, 'project-a', makeIssue('overflow'), 4_000)
    expect(overflow.result).toMatchObject({ ok: false, code: 'queue-full', queueDepth: 10 })

    const first = dequeueIssue(overflow.store, 'project-a', 'agent-a')
    expect(first.issue?.issue.id).toBe('issue-0')
    expect(first.issue?.snapshot.domNodeCount).toBe(900)
    expect(getProjectStatus(first.store, 'project-a', 4_000)?.queueDepth).toBe(9)
  })

  it('rejects dispatch when no healthy agent is watching', () => {
    const unclaimed = dispatchIssue(withProject(), 'project-a', makeIssue(), 2_000)
    expect(unclaimed.result.code).toBe('agent-not-watching')

    const claimed = acquireLease(withProject(), 'project-a', 'agent-a', 1_000).store
    const stale = dispatchIssue(claimed, 'project-a', makeIssue(), 11_000)
    expect(stale.result.code).toBe('agent-not-watching')
  })

  it('lists only recently active projects and expires conflict warnings', () => {
    let hub = createHubStore()
    hub = recordSnapshot(hub, makeEnvelope('old', 'old-browser'), 1_000)
    hub = recordSnapshot(hub, makeEnvelope('active', 'browser-a'), 5_000)
    hub = recordSnapshot(hub, makeEnvelope('active', 'browser-b'), 6_000)
    hub = acquireLease(hub, 'active', 'agent-a', 6_100).store
    hub = acquireLease(hub, 'active', 'agent-b', 6_200).store

    const projects = listActiveProjects(hub, 14_999)
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({ projectId: 'active', instanceCount: 2, agentState: 'watching' })
    expect(getProjectStatus(hub, 'active', 36_199)?.conflictAt).toBe(6_200)
    expect(getProjectStatus(hub, 'active', 36_200)?.conflictAt).toBeNull()
  })

  it('finds historical issues and applies project-scoped actions', () => {
    let hub = withProject('project-a', makeIssue('history-1'))
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'browser-a', [makeIssue('current-1')]), 2_000)

    expect(findProjectIssue(hub, 'project-a', 'history-1')?.id).toBe('history-1')
    hub = acknowledgeProjectIssue(hub, 'project-a', 'current-1')
    expect(getActiveIssues(hub, 'project-a')).toEqual([])
    hub = resolveProjectIssue(hub, 'project-a', 'history-1')
    expect(findProjectIssue(hub, 'project-a', 'history-1')?.id).toBe('history-1')
    expect(getActiveIssues(hub, 'missing')).toEqual([])
  })
})
