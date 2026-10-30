import { describe, expect, it } from 'vitest'
import {
  HUB_INTAKE_LIMITS,
  KEEPALIVE_BODY_LIMIT_BYTES,
  PAYLOAD_LIMITS,
  SNAPSHOT_BODY_BUDGET_BYTES,
  boundEvidence,
  boundIssue,
  boundIssues,
  boundSnapshot,
  compareIssuePriority,
  fitEnvelopeToBytes,
  measureJsonBytes,
  truncateText,
  type DetectorName,
  type ProjectSnapshotEnvelope,
  type Severity,
  type VibeIssue,
  type VibeSnapshot,
} from '../index.js'

let counter = 0
const issue = (overrides: Partial<VibeIssue> = {}): VibeIssue => {
  counter += 1
  return {
    id: `issue-${counter}`,
    detector: 'console-spam',
    severity: 'warning',
    title: 'Console spam',
    description: 'console.log called often',
    evidence: { method: 'log', callCount: 30, windowSeconds: 10, sampleArgs: ['a'] },
    timestamp: 1_000 + counter,
    acknowledged: false,
    resolved: false,
    ...overrides,
  }
}

const snapshot = (issues: readonly VibeIssue[], overrides: Partial<VibeSnapshot> = {}): VibeSnapshot => ({
  timestamp: 10_000,
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
  ...overrides,
})

const envelope = (snap: VibeSnapshot): ProjectSnapshotEnvelope => ({
  projectId: 'shop',
  instanceId: 'tab-1',
  origin: 'http://localhost:3000',
  pageUrl: 'http://localhost:3000/',
  title: 'Shop',
  snapshot: snap,
})

describe('truncateText', () => {
  it('returns short text unchanged and cuts long text with an ellipsis', () => {
    expect(truncateText('short', 10)).toBe('short')
    expect(truncateText('abcdefghij', 5)).toBe('abcd…')
    expect(truncateText('abcdefghij', 5)).toHaveLength(5)
    expect(truncateText('abc', 0)).toBe('')
  })

  it('never splits a surrogate pair', () => {
    const text = `ab${'😀'}cd`
    const cut = truncateText(text, 4)
    expect(cut).toBe('ab…')
  })
})

describe('boundEvidence', () => {
  it('returns the same object when already within limits', () => {
    const evidence = { url: '/api', count: 2, nested: { ok: true } }
    expect(boundEvidence(evidence)).toBe(evidence)
  })

  it('shortens strings, trims arrays, drops extra keys and deep nesting without mutating input', () => {
    const longString = 'x'.repeat(PAYLOAD_LIMITS.maxEvidenceStringChars + 50)
    const evidence: Record<string, unknown> = {
      url: longString,
      list: Array.from({ length: PAYLOAD_LIMITS.maxEvidenceArrayItems + 5 }, (_v, i) => i),
      deep: { a: { b: { c: { d: 1 } } } },
      fn: () => 1,
    }
    for (let i = 0; i < PAYLOAD_LIMITS.maxEvidenceKeys; i += 1) evidence[`k${i}`] = i
    const before = JSON.stringify(evidence)

    const bounded = boundEvidence(evidence)

    expect(JSON.stringify(evidence)).toBe(before)
    expect((bounded['url'] as string).length).toBe(PAYLOAD_LIMITS.maxEvidenceStringChars)
    expect(bounded['list']).toHaveLength(PAYLOAD_LIMITS.maxEvidenceArrayItems)
    expect(bounded['deep']).toEqual({ a: { b: '[truncated]' } })
    expect('fn' in bounded).toBe(false)
    expect(Object.keys(bounded).length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxEvidenceKeys)
  })
})

describe('boundIssue', () => {
  it('clamps title and description (C5: a 2,000-character URL no longer breaks the hub)', () => {
    const url = `/rest/v1/items?id=in.(${'a'.repeat(1_900)})`
    const long = issue({
      detector: 'duplicate-requests',
      title: `Duplicate GET request ${url}`,
      description: `${url} was called 2 times within 2000ms.`,
      evidence: { url, method: 'GET', count: 2, windowMs: 2000 },
    })
    const bounded = boundIssue(long)
    expect(bounded.title.length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxTitleChars)
    expect(bounded.description.length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxDescriptionChars)
    expect((bounded.evidence['url'] as string).length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxEvidenceStringChars)
    expect(bounded.id).toBe(long.id)
    expect(long.title).toContain(url)
  })

  it('returns the same issue object when nothing needs clamping', () => {
    const ok = issue()
    expect(boundIssue(ok)).toBe(ok)
  })
})

describe('issue priority and caps', () => {
  it('orders by severity, then most recently seen', () => {
    const info = issue({ severity: 'info', lastSeenAt: 9_000 })
    const errorOld = issue({ severity: 'error', lastSeenAt: 2_000 })
    const errorNew = issue({ severity: 'error', lastSeenAt: 5_000 })
    expect([info, errorOld, errorNew].sort(compareIssuePriority)).toEqual([errorNew, errorOld, info])
  })

  it('caps per detector and per snapshot, keeps original order, and names detectors that lost issues', () => {
    const spam = Array.from({ length: 40 }, (_v, i) => issue({ detector: 'console-spam', lastSeenAt: 2_000 + i }))
    const shifts = Array.from({ length: 5 }, () => issue({ detector: 'layout-thrashing' }))
    const result = boundIssues([...spam, ...shifts])

    expect(result.issues.filter((item) => item.detector === 'console-spam')).toHaveLength(PAYLOAD_LIMITS.maxIssuesPerDetector)
    expect(result.issues.filter((item) => item.detector === 'layout-thrashing')).toHaveLength(5)
    expect(result.dropped).toBe(40 - PAYLOAD_LIMITS.maxIssuesPerDetector)
    expect(result.droppedDetectors).toEqual(['console-spam'])
    // Newest spam issues survive, and survivors keep their input order.
    const keptSpam = result.issues.filter((item) => item.detector === 'console-spam')
    expect(keptSpam[0]?.lastSeenAt).toBe(2_000 + 40 - PAYLOAD_LIMITS.maxIssuesPerDetector)
    expect(result.issues.at(-1)?.detector).toBe('layout-thrashing')
  })

  it('applies the global cap across detectors', () => {
    const detectors: readonly DetectorName[] = ['console-spam', 'layout-thrashing', 'duplicate-requests', 'memory-leak', 'seo']
    const many = detectors.flatMap((detector) => Array.from({ length: 25 }, () => issue({ detector })))
    const result = boundIssues(many)
    expect(result.issues).toHaveLength(PAYLOAD_LIMITS.maxIssuesPerSnapshot)
    expect(result.dropped).toBe(many.length - PAYLOAD_LIMITS.maxIssuesPerSnapshot)
  })
})

describe('boundSnapshot', () => {
  it('returns the same snapshot when within limits', () => {
    const snap = snapshot([issue(), issue()])
    expect(boundSnapshot(snap)).toBe(snap)
  })

  it('records truncation and merges with what the producer already reported', () => {
    const snap = snapshot(
      Array.from({ length: 30 }, () => issue()),
      { truncation: { droppedIssues: 2, detectors: ['seo'], truncatedFields: 1 } },
    )
    const bounded = boundSnapshot(snap)
    expect(bounded.issues).toHaveLength(PAYLOAD_LIMITS.maxIssuesPerDetector)
    expect(bounded.truncation).toEqual({ droppedIssues: 7, detectors: ['seo', 'console-spam'], truncatedFields: 1 })
    expect(snap.issues).toHaveLength(30)
  })

  it('keeps the newest long frames and the first large resources', () => {
    const entries = Array.from({ length: 30 }, (_v, i) => ({
      duration: 60 + i,
      startTime: i,
      blockingDuration: 10,
      scripts: Array.from({ length: 8 }, () => ({ sourceURL: '/a.js', sourceFunctionName: 'f', duration: 5 })),
    }))
    const largeResources = Array.from({ length: 30 }, (_v, i) => ({ url: `/r${i}.js`, transferSizeKB: 300, type: 'script' }))
    const snap = snapshot([], {
      longFrames: { count: 30, entries, worstFrame: 89 },
      resources: { ...snapshot([]).resources, largeResources },
    })
    const bounded = boundSnapshot(snap)
    expect(bounded.longFrames.entries).toHaveLength(PAYLOAD_LIMITS.maxLongFrameEntries)
    expect(bounded.longFrames.entries[0]?.startTime).toBe(30 - PAYLOAD_LIMITS.maxLongFrameEntries)
    expect(bounded.longFrames.entries[0]?.scripts).toHaveLength(PAYLOAD_LIMITS.maxScriptsPerLongFrame)
    expect(bounded.resources.largeResources).toHaveLength(PAYLOAD_LIMITS.maxLargeResources)
    expect(bounded.truncation?.droppedIssues).toBe(0)
    expect(bounded.truncation?.detectors).toEqual([])
  })

  it('hub intake limits are looser than producer limits', () => {
    expect(HUB_INTAKE_LIMITS.maxIssuesPerSnapshot).toBeGreaterThan(PAYLOAD_LIMITS.maxIssuesPerSnapshot)
    expect(HUB_INTAKE_LIMITS.maxDescriptionChars).toBeGreaterThan(PAYLOAD_LIMITS.maxDescriptionChars)
    const producerBounded = boundSnapshot(snapshot(Array.from({ length: 60 }, () => issue())))
    expect(boundSnapshot(producerBounded, HUB_INTAKE_LIMITS)).toBe(producerBounded)
  })
})

describe('measureJsonBytes', () => {
  it('counts UTF-8 bytes of the JSON body', () => {
    expect(measureJsonBytes('abc')).toBe(5)
    expect(measureJsonBytes('é')).toBe(4)
    expect(measureJsonBytes('😀')).toBe(6)
    expect(measureJsonBytes(undefined)).toBe(0)
  })
})

describe('fitEnvelopeToBytes', () => {
  it('leaves a small envelope untouched', () => {
    const env = envelope(snapshot([issue()]))
    expect(fitEnvelopeToBytes(env)).toBe(env)
  })

  it('keeps a heavy snapshot under the keepalive budget, dropping lowest-priority issues first (C2)', () => {
    const severities: readonly Severity[] = ['info', 'warning', 'error']
    const detectors: readonly DetectorName[] = ['console-spam', 'layout-thrashing', 'memory-leak', 'duplicate-requests', 'seo']
    const issues = detectors.flatMap((detector) => Array.from({ length: 25 }, (_v, i) => issue({
      detector,
      severity: severities[i % 3] ?? 'info',
      description: 'd'.repeat(590),
      evidence: { sampleArgs: ['s'.repeat(900), 't'.repeat(900)], method: `m${i}` },
    })))
    const env = envelope(snapshot(issues))
    expect(measureJsonBytes(env)).toBeGreaterThan(KEEPALIVE_BODY_LIMIT_BYTES)

    const fitted = fitEnvelopeToBytes(env)

    expect(measureJsonBytes(fitted)).toBeLessThanOrEqual(SNAPSHOT_BODY_BUDGET_BYTES)
    expect(fitted.snapshot.issues.length).toBeGreaterThan(0)
    expect(fitted.snapshot.truncation?.droppedIssues).toBe(issues.length - fitted.snapshot.issues.length)
    const lost = new Set(issues.filter((item) => !fitted.snapshot.issues.some((kept) => kept.id === item.id)).map((item) => item.detector))
    expect([...lost].every((detector) => fitted.snapshot.truncation?.detectors.includes(detector))).toBe(true)
    const keptSeverities = new Set(fitted.snapshot.issues.map((item) => item.severity))
    if (keptSeverities.has('info')) expect(keptSeverities.has('error')).toBe(true)
  })

  it('shortens oversized envelope text', () => {
    const env = { ...envelope(snapshot([])), title: 'T'.repeat(500), pageUrl: `http://localhost/${'p'.repeat(3_000)}` }
    const fitted = fitEnvelopeToBytes(env)
    expect(fitted.title.length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxTitleChars)
    expect(fitted.pageUrl.length).toBeLessThanOrEqual(PAYLOAD_LIMITS.maxEnvelopeTextChars)
  })
})
