import { describe, expect, it } from 'vitest'
import {
  compactWorkflowIssues,
  createProjectWorkflow,
  markWorkflowDispatched,
  markWorkflowWorking,
  recordWorkflowSnapshot,
  requestWorkflowVerification,
} from '../workflow.js'
import type {
  ProjectSnapshotEnvelope,
  TrackedProjectIssue,
  VibeIssue,
  VibeSnapshot,
} from '../types.js'

const issue = (id: string): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: `DOM issue ${id}`,
  description: 'Too many nodes',
  evidence: { nodeCount: 1_600 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const snapshot = (issues: readonly VibeIssue[], timestamp: number): VibeSnapshot => ({
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
  domNodeCount: 1_600,
})

const envelope = (
  issues: readonly VibeIssue[],
  path: string,
  timestamp: number,
): ProjectSnapshotEnvelope => ({
  projectId: 'project-a',
  instanceId: 'browser-a',
  origin: 'http://project-a',
  pageUrl: `http://project-a${path}`,
  title: 'Fixture',
  snapshot: snapshot(issues, timestamp),
})

const tracked = (overrides: Partial<TrackedProjectIssue> = {}): TrackedProjectIssue => ({
  issueKey: 'stable-a',
  pageUrl: 'http://project-a/pricing',
  issue: issue('first'),
  occurrenceIds: ['first'],
  phase: 'detected',
  occurrenceCount: 1,
  regressionCount: 0,
  verificationMisses: 0,
  firstSeenAt: 1,
  lastSeenAt: 1,
  events: [{ type: 'detected', at: 1, occurrence: 1 }],
  ...overrides,
})

describe('issue workflow', () => {
  it('moves through work, evidence verification, and regression idempotently', () => {
    let workflow = createProjectWorkflow('project-a')
    workflow = recordWorkflowSnapshot(workflow, envelope([issue('first')], '/pricing', 1), 1)
    const key = workflow.issues[0]!.issueKey
    workflow = markWorkflowDispatched(workflow, key, 2)
    workflow = markWorkflowWorking(workflow, 'first', 3)
    expect(markWorkflowWorking(workflow, 'first', 4)).toBe(workflow)
    workflow = requestWorkflowVerification(workflow, 'first', 5)
    workflow = recordWorkflowSnapshot(workflow, envelope([issue('still-there')], '/pricing', 6), 6)
    expect(workflow.issues[0]?.phase).toBe('working')
    expect(workflow.issues[0]?.events.filter((event) => event.type === 'verification-failed'))
      .toHaveLength(1)

    workflow = requestWorkflowVerification(workflow, 'still-there', 7)
    workflow = recordWorkflowSnapshot(workflow, envelope([], '/other', 8), 8)
    expect(workflow.issues[0]?.phase).toBe('verifying')
    workflow = recordWorkflowSnapshot(workflow, envelope([], '/pricing', 9), 9)
    expect(workflow.issues[0]?.phase).toBe('verifying')
    workflow = recordWorkflowSnapshot(workflow, envelope([], '/pricing', 10), 10)
    expect(workflow.issues[0]?.phase).toBe('fixed')

    workflow = recordWorkflowSnapshot(workflow, envelope([issue('returned')], '/pricing', 11), 11)
    expect(workflow.issues[0]).toMatchObject({
      phase: 'regressed',
      occurrenceCount: 2,
      regressionCount: 1,
      verificationMisses: 0,
    })
    expect(workflow.issues[0]?.events.map((event) => event.type)).toEqual([
      'detected',
      'sent',
      'working',
      'verification-requested',
      'verification-failed',
      'verification-requested',
      'fixed',
      'regressed',
    ])
  })

  it('caps transient history without evicting actionable or fixed baselines', () => {
    const protectedIssues = [
      tracked({ issueKey: 'regressed', phase: 'regressed' }),
      tracked({ issueKey: 'fixed', phase: 'fixed' }),
    ]
    const transient = Array.from({ length: 220 }, (_, index) =>
      tracked({ issueKey: `old-${index}`, phase: 'detected', lastSeenAt: index }))
    const compacted = compactWorkflowIssues([...protectedIssues, ...transient])

    expect(compacted).toHaveLength(200)
    expect(compacted).toEqual(expect.arrayContaining(protectedIssues))
    expect(compacted.some((item) => item.issueKey === 'old-0')).toBe(false)
  })

  it('ignores same-page evidence that is not newer than the verification request', () => {
    let workflow = recordWorkflowSnapshot(
      createProjectWorkflow('project-a'),
      envelope([issue('first')], '/pricing', 1),
      1,
    )
    workflow = requestWorkflowVerification(workflow, 'first', 5)
    const stale = recordWorkflowSnapshot(workflow, envelope([], '/pricing', 5), 6)

    expect(stale.issues[0]).toMatchObject({ phase: 'verifying', verificationMisses: 0 })
    expect(stale).toBe(workflow)
  })

  it('accepts an earlier occurrence id after a newer scan replaces the browser id', () => {
    let workflow = recordWorkflowSnapshot(
      createProjectWorkflow('project-a'),
      envelope([issue('first')], '/pricing', 1),
      1,
    )
    workflow = recordWorkflowSnapshot(workflow, envelope([issue('new-id')], '/pricing', 2), 2)
    workflow = requestWorkflowVerification(workflow, 'first', 3)

    expect(workflow.issues[0]).toMatchObject({
      phase: 'verifying',
      occurrenceIds: ['first', 'new-id'],
    })
  })

})
