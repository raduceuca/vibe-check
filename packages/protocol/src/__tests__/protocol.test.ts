import { describe, it, expect } from 'vitest'
import {
  AGENT_CONNECTION_STATES,
  DETECTOR_NAMES,
  DISPATCH_RESULT_CODES,
  SEVERITIES,
} from '../index.js'
import type {
  DetectorName,
  DispatchIssueResponse,
  IssueEvidenceMap,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  Severity,
  VibeSnapshot,
} from '../index.js'

const makeSnapshot = (): VibeSnapshot => ({
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
  issues: [],
  domNodeCount: 10,
})

describe('protocol enums', () => {
  it('DETECTOR_NAMES has no duplicates', () => {
    expect(new Set(DETECTOR_NAMES).size).toBe(DETECTOR_NAMES.length)
  })

  it('SEVERITIES has no duplicates', () => {
    expect(new Set(SEVERITIES).size).toBe(SEVERITIES.length)
  })

  it('DetectorName type is derived from DETECTOR_NAMES (compile-time single source)', () => {
    // If these arrays and the derived types ever diverge this file fails to
    // type-check, which is the whole point of deriving the type from the array.
    const names: readonly DetectorName[] = DETECTOR_NAMES
    const severities: readonly Severity[] = SEVERITIES
    expect(names.length).toBeGreaterThan(0)
    expect(severities).toContain('critical')
  })

  it('IssueEvidenceMap covers every detector', () => {
    // Type-level exhaustiveness: a Record keyed by DetectorName forces an entry
    // for each detector, and IssueEvidenceMap must supply each key.
    const present: Record<DetectorName, true> = DETECTOR_NAMES.reduce(
      (acc, name) => ({ ...acc, [name]: true }),
      {} as Record<DetectorName, true>,
    )
    const evidenceKeys: ReadonlyArray<keyof IssueEvidenceMap> = DETECTOR_NAMES
    expect(Object.keys(present).sort()).toEqual([...DETECTOR_NAMES].sort())
    expect(evidenceKeys.length).toBe(DETECTOR_NAMES.length)
  })

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
      'dispatched',
      'unconfigured',
      'hub-offline',
      'agent-not-watching',
      'queue-full',
      'invalid-issue',
      'failed',
    ])
  })
})
