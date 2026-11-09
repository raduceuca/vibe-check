import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  MAX_DISPATCH_QUEUE,
  acquireLease,
  acknowledgeProjectIssue,
  confirmDelivery,
  createHubStore,
  dispatchIssue,
  findProjectIssue,
  getActiveIssues,
  getProjectStatus,
  getProjectWorkflow,
  handOffIssue,
  heartbeatLease,
  listActiveProjects,
  markLeaseBusy,
  markWatchStarted,
  recordSnapshot,
  releaseLease,
  resolveProjectIssue,
  type WaitingLookup,
} from '../hubStore.js'
import { deriveProjectImpact } from '../impact.js'
import type { DetectorRunStatus, ProjectSnapshotEnvelope, VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (id = 'dom-1', detector: VibeIssue['detector'] = 'dom-bloat'): VibeIssue => ({
  id,
  detector,
  severity: 'warning',
  title: `DOM issue ${id}`,
  description: 'Too many nodes',
  evidence: detector === 'duplicate-requests'
    ? { count: 5, url: '/api/menu', method: 'GET' }
    : { nodeCount: 900 },
  timestamp: 1,
  lastSeenAt: 1,
  occurrences: 1,
  acknowledged: false,
  resolved: false,
})

const detectorStatus = (
  detector: VibeIssue['detector'],
  evaluatedAt: number,
): DetectorRunStatus => ({
  detector,
  kind: detector === 'seo' || detector === 'aeo' || detector === 'web-essentials' ? 'audit' : 'continuous',
  observingSince: evaluatedAt - 1,
  settledAt: evaluatedAt - 1,
  evaluatedAt,
})

const makeSnapshot = (
  issues: readonly VibeIssue[] = [],
  timestamp = 1,
): VibeSnapshot => ({
  timestamp,
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
  engineStartedAt: timestamp - 10,
  detectors: [...new Set(issues.map((item) => item.detector).concat('dom-bloat' as const))]
    .map((detector) => detectorStatus(detector, timestamp)),
})

const makeEnvelope = (
  projectId: string,
  instanceId: string,
  issues: readonly VibeIssue[] = [],
  timestamp = 1,
): ProjectSnapshotEnvelope => ({
  projectId,
  instanceId,
  origin: projectId,
  pageUrl: `http://${projectId}/fixture`,
  title: `Fixture ${projectId}`,
  snapshot: makeSnapshot(issues, timestamp),
})

const withProject = (
  projectId = 'project-a',
  issue = makeIssue(),
  now = 1_000,
) => recordSnapshot(createHubStore(), makeEnvelope(projectId, 'browser-a', [issue], now), now)

const waitingNone: WaitingLookup = () => false
const waitingFor = (sessionId: string): WaitingLookup =>
  (_projectId, sid) => sid === sessionId

describe('hubStore', () => {
  it('keeps projects isolated and rejects a second watcher', () => {
    let hub = createHubStore()
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'a', [makeIssue('a-1')]), 1_000)
    hub = recordSnapshot(hub, makeEnvelope('project-b', 'b', [makeIssue('b-1')]), 1_000)

    const first = acquireLease(hub, 'project-a', 'agent-a', 2_000)
    expect(first.result).toEqual({ ok: true, projectId: 'project-a', expiresAt: 17_000 })

    const conflict = acquireLease(first.store, 'project-a', 'agent-b', 3_000)
    expect(conflict.result).toMatchObject({ ok: false, code: 'lease-conflict', projectId: 'project-a' })
    expect(conflict.result.message).toMatch(/agent/i)
    expect(getProjectStatus(conflict.store, 'project-a', 3_000)?.conflictAt).toBe(3_000)
    expect(getProjectStatus(conflict.store, 'project-a', 3_000)?.state).toBe('leased')
    expect(getProjectStatus(conflict.store, 'project-b', 3_000)?.state).toBe('no-agent')
    expect(getActiveIssues(conflict.store, 'project-a').map((item) => item.id)).toEqual(['a-1'])
    expect(getActiveIssues(conflict.store, 'project-b').map((item) => item.id)).toEqual(['b-1'])
  })

  it('allows one project lease per agent session', () => {
    let hub = createHubStore()
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'a'), 1_000)
    hub = recordSnapshot(hub, makeEnvelope('project-b', 'b'), 1_000)
    hub = acquireLease(hub, 'project-a', 'agent-a', 2_000).store

    const second = acquireLease(hub, 'project-b', 'agent-a', 2_100)
    expect(second.result).toMatchObject({
      ok: false,
      code: 'session-already-watching',
      projectId: 'project-a',
    })

    const released = releaseLease(second.store, 'project-a', 'agent-a')
    expect(acquireLease(released, 'project-b', 'agent-a', 2_200).result.ok).toBe(true)
  })

  it('marks a missing heartbeat stale at 10s and expires it at 15s', () => {
    const claimed = acquireLease(withProject(), 'project-a', 'agent-a', 1_000).store

    expect(getProjectStatus(claimed, 'project-a', 10_999)?.state).toBe('leased')
    expect(getProjectStatus(claimed, 'project-a', 11_000)?.state).toBe('stale')
    expect(getProjectStatus(claimed, 'project-a', 16_000)?.state).toBe('no-agent')

    const renewed = heartbeatLease(claimed, 'project-a', 'agent-a', 10_000)
    expect(renewed.result).toEqual({ ok: true, projectId: 'project-a', expiresAt: 25_000 })
    expect(getProjectStatus(renewed.store, 'project-a', 19_999)?.state).toBe('leased')
  })

  it('tracks watching and busy independently of queue depth', () => {
    let hub = acquireLease(withProject(), 'project-a', 'agent-a', 2_000).store
    hub = markLeaseBusy(hub, 'project-a', 'agent-a')
    expect(getProjectStatus(hub, 'project-a', 2_100, waitingNone)?.state).toBe('busy')
    hub = markWatchStarted(hub, 'project-a', 'agent-a')
    expect(getProjectStatus(hub, 'project-a', 2_100, waitingFor('agent-a'))?.state).toBe('watching')
  })

  it('queues at most ten issues and preserves FIFO dispatch context', () => {
    let hub = acquireLease(withProject(), 'project-a', 'agent-a', 2_000).store
    // Distinct identities (console-spam method) so each dispatch is a new queue entry.
    const uniqueIssue = (index: number): VibeIssue => ({
      ...makeIssue(`issue-${index}`, 'console-spam'),
      evidence: { method: `log-${index}`, count: 20, sampleArgs: ['x'] },
    })

    for (let index = 0; index < MAX_DISPATCH_QUEUE; index += 1) {
      const issue = uniqueIssue(index)
      hub = recordSnapshot(hub, makeEnvelope('project-a', 'browser-a', [issue], 3_000 + index), 3_000 + index)
      const dispatched = dispatchIssue(
        hub,
        'project-a',
        'http://project-a/fixture',
        issue,
        3_000 + index,
        randomUUID(),
      )
      expect(dispatched.result.ok).toBe(true)
      hub = dispatched.store
    }

    const overflowIssue = uniqueIssue(99)
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'browser-a', [overflowIssue], 4_000), 4_000)
    const overflow = dispatchIssue(
      hub,
      'project-a',
      'http://project-a/fixture',
      overflowIssue,
      4_000,
      randomUUID(),
    )
    expect(overflow.result).toMatchObject({ ok: false, code: 'queue-full', queueDepth: 10 })

    const first = handOffIssue(overflow.store, 'project-a', 'agent-a', 4_001)
    expect(first.issue?.issue.id).toBe('issue-0')
    expect(first.issue?.snapshot.domNodeCount).toBe(900)
    expect(getProjectStatus(first.store, 'project-a', 4_000)?.queueDepth).toBe(9)
  })

  it('rejects dispatch when no healthy agent is watching', () => {
    const unclaimed = dispatchIssue(
      withProject(), 'project-a', 'http://project-a/fixture', makeIssue(), 2_000, randomUUID(),
    )
    expect(unclaimed.result.code).toBe('agent-not-watching')

    const claimed = acquireLease(withProject(), 'project-a', 'agent-a', 1_000).store
    const stale = dispatchIssue(
      claimed, 'project-a', 'http://project-a/fixture', makeIssue(), 11_000, randomUUID(),
    )
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
    expect(projects[0]).toMatchObject({ projectId: 'active', instanceCount: 2, agentState: 'leased' })
    expect(getProjectStatus(hub, 'active', 36_199)?.conflictAt).toBe(6_200)
    expect(getProjectStatus(hub, 'active', 36_200)?.conflictAt).toBeNull()
  })

  it('finds historical issues and applies project-scoped actions', () => {
    let hub = withProject('project-a', makeIssue('history-1'))
    hub = recordSnapshot(hub, makeEnvelope('project-a', 'browser-a', [makeIssue('current-1')], 2_000), 2_000)
    hub = acquireLease(hub, 'project-a', 'agent-a', 2_500).store

    expect(findProjectIssue(hub, 'project-a', 'history-1')?.id).toBe('history-1')
    hub = acknowledgeProjectIssue(hub, 'project-a', 'agent-a', 'current-1', 3_000).store
    expect(getActiveIssues(hub, 'project-a')).toEqual([])
    hub = resolveProjectIssue(hub, 'project-a', 'agent-a', 'history-1', 4_000).store
    expect(findProjectIssue(hub, 'project-a', 'history-1')?.id).toBe('history-1')
    expect(getActiveIssues(hub, 'missing')).toEqual([])
  })

  it('records measured impact only when browser evidence confirms a fix', () => {
    const duplicate = makeIssue('duplicate-1', 'duplicate-requests')
    const measuredSnapshot = (
      timestamp: number,
      issues: readonly VibeIssue[],
      domNodeCount: number,
      transferKB: number,
    ): VibeSnapshot => ({
      ...makeSnapshot(issues, timestamp),
      timestamp,
      domNodeCount,
      resources: { ...makeSnapshot().resources, totalTransferKB: transferKB },
      detectors: [detectorStatus('duplicate-requests', timestamp)],
    })
    const envelope = (snapshot: VibeSnapshot): ProjectSnapshotEnvelope => ({
      ...makeEnvelope('project-a', 'browser-a'),
      snapshot,
    })

    let hub = recordSnapshot(
      createHubStore(),
      envelope(measuredSnapshot(10, [duplicate], 1_200, 900)),
      10,
    )
    hub = acquireLease(hub, 'project-a', 'agent-a', 11).store
    const dispatched = dispatchIssue(
      hub, 'project-a', 'http://project-a/fixture', duplicate, 12, randomUUID(),
    )
    hub = dispatched.store
    const handed = handOffIssue(hub, 'project-a', 'agent-a', 13)
    hub = handed.store
    hub = confirmDelivery(
      hub, 'project-a', 'agent-a', handed.issue!.deliveryId!, 13,
    ).store
    hub = resolveProjectIssue(hub, 'project-a', 'agent-a', duplicate.id, 14).store
    hub = recordSnapshot(hub, envelope(measuredSnapshot(20, [], 800, 600)), 20)
    hub = recordSnapshot(hub, envelope(measuredSnapshot(21, [], 800, 600)), 21)

    const workflow = getProjectWorkflow(hub, 'project-a')
    if (!workflow) throw new Error('Expected workflow')
    expect(deriveProjectImpact(workflow, workflow.impactReceipts)).toMatchObject({
      uniqueIssuesFixed: 1,
      verifiedFixes: 1,
      metrics: expect.arrayContaining([
        expect.objectContaining({ kind: 'duplicate-requests-removed', value: 4 }),
        expect.objectContaining({ kind: 'dom-nodes-reduced', value: 400 }),
        expect.objectContaining({ kind: 'transfer-kb-reduced', value: 300 }),
      ]),
    })
  })
})
