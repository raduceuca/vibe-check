import { describe, it, expect } from 'vitest'
import { getSuggestion } from '../suggestions/index.js'
import type { DetectorName, VibeIssue } from '../types.js'

const makeIssue = (detector: DetectorName, evidence: Record<string, unknown> = {}): VibeIssue => ({
  id: `test-${detector}`,
  detector,
  severity: 'warning',
  title: `Test ${detector}`,
  description: `Test issue for ${detector}`,
  evidence,
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
})

const ALL_DETECTORS: readonly DetectorName[] = [
  'dom-bloat',
  'duplicate-requests',
  'console-spam',
  'memory-leak',
  'layout-thrashing',
  'unoptimized-images',
  'long-task-attribution',
  'resource-bloat',
]

describe('getSuggestion', () => {
  it.each(ALL_DETECTORS)('returns markdown for %s detector', (detector) => {
    const issue = makeIssue(detector, { sampleKey: 'sampleValue' })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('##')
    expect(suggestion).toContain('Fix Steps')
    expect(suggestion).toContain('Common AI-Coding Causes')
  })

  it('returns "No suggestion available" for unknown detector', () => {
    const issue = makeIssue('dom-bloat')
    const unknownIssue = { ...issue, detector: 'unknown-detector' as DetectorName }

    const suggestion = getSuggestion(unknownIssue)

    expect(suggestion).toBe('No suggestion available')
  })

  it('includes evidence data in dom-bloat output', () => {
    const issue = makeIssue('dom-bloat', { nodeCount: 8500 })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('8500')
  })

  it('includes evidence data in duplicate-requests output', () => {
    const issue = makeIssue('duplicate-requests', {
      url: '/api/users',
      count: 5,
    })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('/api/users')
    expect(suggestion).toContain('5')
  })

  it('includes evidence data in memory-leak output', () => {
    // Real keys emitted by createMemoryLeakDetector (currentMB / heapGrowthPct),
    // not the jsHeapSizeMB / growthRate this template used to misread.
    const issue = makeIssue('memory-leak', {
      currentMB: 256,
      heapGrowthPct: 12,
    })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('256')
    expect(suggestion).toContain('12')
  })

  it('includes evidence data in resource-bloat output', () => {
    // resource-bloat is emitted per-resource: { url, transferSizeKB, type }.
    const issue = makeIssue('resource-bloat', {
      url: '/assets/app.js',
      transferSizeKB: 5000,
      type: 'script',
    })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('5000')
    expect(suggestion).toContain('script')
    expect(suggestion).toContain('/assets/app.js')
  })
})

// ── Anti-drift: each template must read the keys the detector actually emits ──
// Every entry uses the GROUND-TRUTH evidence keys produced by the corresponding
// detector's createIssue() call. If a template reads a stale/renamed key, the
// real value won't appear in the rendered markdown and the case fails — exactly
// the regression (#7) where 6-7 templates rendered "unknown" in production.
const REAL_EVIDENCE: ReadonlyArray<{
  readonly detector: DetectorName
  readonly evidence: Record<string, unknown>
  readonly expected: readonly string[]
}> = [
  { detector: 'dom-bloat', evidence: { nodeCount: 8500, maxDepth: 22 }, expected: ['8500'] },
  { detector: 'duplicate-requests', evidence: { url: '/api/users', count: 5, method: 'GET' }, expected: ['/api/users', '5'] },
  { detector: 'console-spam', evidence: { method: 'log', callCount: 50, windowSeconds: 10, sampleArgs: ['hello', 'world'] }, expected: ['50'] },
  { detector: 'memory-leak', evidence: { currentMB: 256, heapGrowthPct: 12, baselineMB: 200 }, expected: ['256', '12'] },
  { detector: 'layout-thrashing', evidence: { shiftCount: 7, totalShiftValue: 0.31, clusterDurationMs: 420 }, expected: ['7', '420'] },
  { detector: 'unoptimized-images', evidence: { src: '/img/hero.png', issue: 'missing-dimensions' }, expected: ['/img/hero.png', 'missing-dimensions'] },
  { detector: 'large-images', evidence: { src: '/img/big.png', transferSizeKB: 900, naturalWidth: 4000 }, expected: ['/img/big.png', '900'] },
  { detector: 'long-task-attribution', evidence: { sourceURL: '/app.js', totalBlockingMs: 320, longFrameCount: 4 }, expected: ['/app.js', '320'] },
  { detector: 'resource-bloat', evidence: { url: '/vendor.js', transferSizeKB: 5000, type: 'script' }, expected: ['/vendor.js', '5000', 'script'] },
  { detector: 'web-essentials', evidence: { check: 'missing-viewport' }, expected: ['missing-viewport'] },
  { detector: 'heavy-library', evidence: { library: 'Moment', packageName: 'moment', bundleSizeKB: 290, knownIssues: ['no tree-shaking'] }, expected: ['Moment', '290'] },
]

describe('getSuggestion — no evidence-key drift', () => {
  it.each(REAL_EVIDENCE)('renders real evidence values for $detector', ({ detector, evidence, expected }) => {
    const suggestion = getSuggestion(makeIssue(detector, evidence))
    for (const value of expected) {
      expect(suggestion).toContain(value)
    }
    // The "What:" headline (first paragraph) must not fall back to a placeholder
    // when real evidence was supplied.
    const headline = suggestion.split('### ')[0]
    expect(headline).not.toContain('unknown')
  })
})
