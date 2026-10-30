import { describe, it, expect } from 'vitest'
import { HUB_INTAKE_LIMITS } from '@wcgw/vibe-check-protocol'
import {
  parseDispatchIssueRequest,
  parseProjectSnapshotEnvelope,
  parseSnapshot,
} from '../schema.js'
import type { VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (overrides: Partial<VibeIssue> = {}): VibeIssue => ({
  id: 'issue-1',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 9000 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 9000 },
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
  ...overrides,
})

const makeSnapshot = (issues: readonly VibeIssue[] = []): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.67, maxFrameTime: 20, droppedFrames: 0, smoothness: 1 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 100, jsTransferKB: 50, cssTransferKB: 20, imageTransferKB: 20, fontTransferKB: 10, resourceCount: 5, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues,
  domNodeCount: 500,
})

describe('parseSnapshot', () => {
  it('accepts a well-formed snapshot (with and without issues)', () => {
    expect(parseSnapshot(makeSnapshot())).not.toBeNull()
    expect(parseSnapshot(makeSnapshot([makeIssue()]))).not.toBeNull()
  })

  it('rejects non-object / missing required fields', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('nope')).toBeNull()
    expect(parseSnapshot({ invalid: true })).toBeNull()
  })

  it('rejects an unknown detector (enum is single-sourced from the protocol)', () => {
    const bad = makeSnapshot([makeIssue({ detector: 'made-up' as VibeIssue['detector'] })])
    expect(parseSnapshot(bad)).toBeNull()
  })

  it('rejects an out-of-enum severity', () => {
    const bad = makeSnapshot([makeIssue({ severity: 'fatal' as VibeIssue['severity'] })])
    expect(parseSnapshot(bad)).toBeNull()
  })

  it('clamps over-long agent-facing strings (MCP-08)', () => {
    const parsed = parseSnapshot(makeSnapshot([makeIssue({ description: 'x'.repeat(5_000) })]))
    expect(parsed).not.toBeNull()
    expect(parsed!.issues[0]!.description.length).toBeLessThanOrEqual(HUB_INTAKE_LIMITS.maxDescriptionChars)
  })

  it('keeps the highest-priority issues when the snapshot is too large (MCP-08)', () => {
    const many = Array.from({ length: 501 }, (_, i) => makeIssue({ id: `i-${i}` }))
    const parsed = parseSnapshot(makeSnapshot(many))
    expect(parsed).not.toBeNull()
    expect(parsed!.issues.length).toBeLessThanOrEqual(HUB_INTAKE_LIMITS.maxIssuesPerSnapshot)
    expect(parsed!.truncation?.droppedIssues).toBeGreaterThan(0)
  })
})

describe('project browser messages', () => {
  it('requires a page URL and truncates over-long ones', () => {
    const envelope = {
      projectId: 'project-a',
      instanceId: 'browser-a',
      origin: 'http://localhost:3000',
      pageUrl: 'http://localhost:3000/pricing?plan=pro',
      title: 'Pricing',
      snapshot: makeSnapshot(),
    }
    const dispatch = {
      projectId: 'project-a',
      instanceId: 'browser-a',
      pageUrl: 'http://localhost:3000/pricing?plan=pro',
      issue: makeIssue(),
    }

    expect(parseProjectSnapshotEnvelope(envelope)).not.toBeNull()
    expect(parseDispatchIssueRequest(dispatch)).not.toBeNull()
    expect(parseProjectSnapshotEnvelope({ ...envelope, pageUrl: undefined })).toBeNull()
    const long = parseDispatchIssueRequest({ ...dispatch, pageUrl: 'x'.repeat(2_001) })
    expect(long).not.toBeNull()
    expect(long!.pageUrl.length).toBeLessThanOrEqual(HUB_INTAKE_LIMITS.maxEnvelopeTextChars)
  })
})
