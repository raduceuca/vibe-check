import { describe, expect, it } from 'vitest'
import {
  AUDIT_DETECTORS,
  DETECTOR_KINDS,
  DETECTOR_NAMES,
  LEGACY_VERIFICATION_DELAY_MS,
  classifyVerificationSnapshot,
  getDetectorRunStatus,
  isAuditDetector,
  issueLastSeenAt,
  type DetectorRunStatus,
  type VibeIssue,
  type VibeSnapshot,
} from '../index.js'

const REQUESTED_AT = 50_000

const issue = (overrides: Partial<VibeIssue> = {}): VibeIssue => ({
  id: 'dup-1',
  detector: 'duplicate-requests',
  severity: 'warning',
  title: 'Duplicate GET request',
  description: '',
  evidence: { url: '/api/profile', method: 'GET', count: 2, windowMs: 2000 },
  timestamp: 10_000,
  acknowledged: false,
  resolved: false,
  ...overrides,
})

const status = (overrides: Partial<DetectorRunStatus> = {}): DetectorRunStatus => ({
  detector: 'duplicate-requests',
  kind: 'continuous',
  observingSince: 1_000,
  settledAt: 6_000,
  evaluatedAt: 60_000,
  ...overrides,
})

const snapshot = (
  issues: readonly VibeIssue[],
  detectors: readonly DetectorRunStatus[] | undefined,
  overrides: Partial<VibeSnapshot> = {},
): VibeSnapshot => ({
  timestamp: 60_000,
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
  domNodeCount: 100,
  ...(detectors === undefined ? {} : { detectors, engineStartedAt: 1_000 }),
  ...overrides,
})

const classify = (snap: VibeSnapshot, present?: VibeIssue, tracked: VibeIssue = issue()) =>
  classifyVerificationSnapshot({ snapshot: snap, issue: tracked, present, requestedAt: REQUESTED_AT })

describe('detector kinds', () => {
  it('classifies every detector and marks exactly the audits', () => {
    expect(Object.keys(DETECTOR_KINDS).sort()).toEqual([...DETECTOR_NAMES].sort())
    const audits = DETECTOR_NAMES.filter((name) => DETECTOR_KINDS[name] === 'audit')
    expect(audits.sort()).toEqual([...AUDIT_DETECTORS].sort())
    expect(isAuditDetector('seo')).toBe(true)
    expect(isAuditDetector('dom-bloat')).toBe(false)
  })
})

describe('issueLastSeenAt', () => {
  it('falls back to timestamp for 0.3 issues and never goes below it', () => {
    expect(issueLastSeenAt(issue())).toBe(10_000)
    expect(issueLastSeenAt(issue({ lastSeenAt: 70_000 }))).toBe(70_000)
    expect(issueLastSeenAt(issue({ lastSeenAt: 5 }))).toBe(10_000)
  })
})

describe('classifyVerificationSnapshot (0.4 snapshots)', () => {
  it('ignores snapshots taken before the request', () => {
    expect(classify(snapshot([], [status()], { timestamp: REQUESTED_AT })))
      .toEqual({ kind: 'inconclusive', reason: 'snapshot-before-request' })
  })

  it('fails verification only when the condition recurred after the request', () => {
    const recurred = issue({ lastSeenAt: 55_000 })
    expect(classify(snapshot([recurred], [status()]), recurred)).toEqual({ kind: 'recurred', at: 55_000 })
  })

  it('waits instead of failing when the issue is a stale latch from before the request (C4: HMR fix)', () => {
    const latched = issue({ lastSeenAt: 20_000 })
    expect(classify(snapshot([latched], [status()]), latched))
      .toEqual({ kind: 'inconclusive', reason: 'stale-issue' })
  })

  it('counts absence only from a detector that is running, settled and evaluated after the request (C1)', () => {
    expect(classify(snapshot([], [status()]))).toEqual({ kind: 'clean', confidence: 'measured' })
    expect(classify(snapshot([], [])))
      .toEqual({ kind: 'inconclusive', reason: 'detector-not-running' })
    expect(classify(snapshot([], [status({ observingSince: 58_000, settledAt: null, evaluatedAt: null })])))
      .toEqual({ kind: 'inconclusive', reason: 'detector-not-settled' })
    expect(classify(snapshot([], [status({ evaluatedAt: 40_000 })])))
      .toEqual({ kind: 'inconclusive', reason: 'evaluation-before-request' })
  })

  it('treats an audit that has not re-run since the request as no evidence', () => {
    const seoIssue = issue({ detector: 'seo', evidence: { check: 'h1-missing' } })
    const seoStatus = status({ detector: 'seo', kind: 'audit', settledAt: 2_000, evaluatedAt: 2_000 })
    expect(classify(snapshot([], [seoStatus]), undefined, seoIssue))
      .toEqual({ kind: 'inconclusive', reason: 'evaluation-before-request' })
    const rerun = status({ detector: 'seo', kind: 'audit', observingSince: 52_000, settledAt: 53_000, evaluatedAt: 53_000 })
    expect(classify(snapshot([], [rerun]), undefined, seoIssue)).toEqual({ kind: 'clean', confidence: 'measured' })
  })

  it('never counts a check the run could not evaluate', () => {
    const sitemap = issue({ detector: 'seo', evidence: { check: 'sitemap-missing' } })
    const seoStatus = status({
      detector: 'seo',
      kind: 'audit',
      settledAt: 53_000,
      evaluatedAt: 53_000,
      inconclusiveChecks: ['sitemap-missing'],
    })
    expect(classify(snapshot([], [seoStatus]), undefined, sitemap))
      .toEqual({ kind: 'inconclusive', reason: 'check-not-evaluated' })
  })

  it('never counts absence from a detector that lost issues to truncation', () => {
    const snap = snapshot([], [status()], {
      truncation: { droppedIssues: 3, detectors: ['duplicate-requests'], truncatedFields: 0 },
    })
    expect(classify(snap)).toEqual({ kind: 'inconclusive', reason: 'truncated' })
  })

  it('finds a detector status by name', () => {
    const snap = snapshot([], [status(), status({ detector: 'seo', kind: 'audit' })])
    expect(getDetectorRunStatus(snap, 'seo')?.kind).toBe('audit')
    expect(getDetectorRunStatus(snap, 'aeo')).toBeNull()
    expect(getDetectorRunStatus(snapshot([], undefined), 'seo')).toBeNull()
  })
})

describe('classifyVerificationSnapshot (legacy 0.3 snapshots)', () => {
  it('keeps the 0.3 rule for presence after the request', () => {
    const present = issue()
    expect(classify(snapshot([present], undefined), present)).toEqual({ kind: 'recurred', at: 60_000 })
  })

  it('only counts absence after the legacy delay, as an estimate', () => {
    expect(classify(snapshot([], undefined, { timestamp: REQUESTED_AT + 4_000 })))
      .toEqual({ kind: 'inconclusive', reason: 'legacy-too-soon' })
    expect(classify(snapshot([], undefined, { timestamp: REQUESTED_AT + LEGACY_VERIFICATION_DELAY_MS })))
      .toEqual({ kind: 'clean', confidence: 'estimated' })
  })
})
