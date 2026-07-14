import { describe, expect, it } from 'vitest'
import type {
  ProjectSnapshotEnvelope,
  TrackedProjectIssue,
  VibeIssue,
  VibeSnapshot,
} from '../types.js'
import { createImpactReceipts, type ImpactBaseline } from '../impactAdapters.js'

const issue = (id: string, detector: VibeIssue['detector'] = 'duplicate-requests'): VibeIssue => ({
  id,
  detector,
  severity: 'warning',
  title: 'Repeated request',
  description: 'Repeated work',
  evidence: detector === 'duplicate-requests'
    ? { count: 5, url: '/api/menu', method: 'GET' }
    : { callCount: 12, method: 'log' },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const tracked = (issueKey: string, finding = issue(issueKey)): TrackedProjectIssue => ({
  issueKey,
  pageUrl: 'http://localhost:3000/menu',
  issue: finding,
  occurrenceIds: [finding.id],
  phase: 'verifying',
  occurrenceCount: 1,
  regressionCount: 0,
  verificationMisses: 1,
  firstSeenAt: 1,
  lastSeenAt: 10,
  events: [],
})

const snapshot = (input: {
  readonly timestamp: number
  readonly domNodeCount: number
  readonly transferKB: number
  readonly blockingMs: number
  readonly consoleCount?: number
}): VibeSnapshot => ({
  timestamp: input.timestamp,
  frameRate: { fps: 60, avgFrameTime: 16, maxFrameTime: 16, droppedFrames: 0, smoothness: 100 },
  longFrames: {
    count: input.blockingMs > 0 ? 1 : 0,
    entries: input.blockingMs > 0 ? [{
      duration: input.blockingMs + 50,
      startTime: 1,
      blockingDuration: input.blockingMs,
      scripts: [],
    }] : [],
    worstFrame: input.blockingMs + 50,
  },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: {
    totalTransferKB: input.transferKB,
    jsTransferKB: 0,
    cssTransferKB: 0,
    imageTransferKB: 0,
    fontTransferKB: 0,
    resourceCount: 0,
    largeResources: [],
  },
  console: { logCount: input.consoleCount ?? 0, warnCount: 0, errorCount: 0, totalCount: input.consoleCount ?? 0 },
  issues: [],
  domNodeCount: input.domNodeCount,
})

const baseline: ImpactBaseline = {
  pageUrl: 'http://localhost:3000/menu?before=1',
  snapshot: snapshot({ timestamp: 10, domNodeCount: 1_200, transferKB: 900, blockingMs: 300 }),
}

const verification = (pageUrl = 'http://localhost:3000/menu?after=1'): ProjectSnapshotEnvelope => ({
  projectId: 'project-a',
  instanceId: 'browser-a',
  origin: 'http://localhost:3000',
  pageUrl,
  title: 'Menu',
  snapshot: snapshot({ timestamp: 20, domNodeCount: 800, transferKB: 600, blockingMs: 100 }),
})

describe('impact adapters', () => {
  it('measures duplicate excess and comparable page totals', () => {
    expect(createImpactReceipts({
      tracked: tracked('duplicate-key'),
      baseline,
      verification: verification(),
      verifyingIssueKeys: ['duplicate-key'],
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'duplicate-requests-removed', before: 4, after: 0, delta: 4 }),
      expect.objectContaining({ kind: 'dom-nodes-reduced', delta: 400 }),
      expect.objectContaining({ kind: 'transfer-kb-reduced', delta: 300 }),
      expect.objectContaining({ kind: 'blocking-ms-reduced', delta: 200 }),
    ]))
  })

  it('attributes one page-level delta to a simultaneous verification batch', () => {
    const first = createImpactReceipts({
      tracked: tracked('a'), baseline, verification: verification(), verifyingIssueKeys: ['b', 'a'],
    })
    const second = createImpactReceipts({
      tracked: tracked('b'), baseline, verification: verification(), verifyingIssueKeys: ['b', 'a'],
    })
    const pageReceipts = [...first, ...second]
      .filter((item) => item.kind === 'transfer-kb-reduced')
    expect(pageReceipts).toHaveLength(1)
    expect(pageReceipts[0]?.issueKey).toBe('batch:a,b')
  })

  it('omits cross-page, stale, and worsening measurements', () => {
    expect(createImpactReceipts({
      tracked: tracked('duplicate-key'),
      baseline,
      verification: verification('http://localhost:3000/other'),
      verifyingIssueKeys: ['duplicate-key'],
    })).toEqual([])
    expect(createImpactReceipts({
      tracked: tracked('duplicate-key'),
      baseline,
      verification: { ...verification(), snapshot: snapshot({ timestamp: 9, domNodeCount: 1_300, transferKB: 1_000, blockingMs: 400 }) },
      verifyingIssueKeys: ['duplicate-key'],
    })).toEqual([])
  })
})
