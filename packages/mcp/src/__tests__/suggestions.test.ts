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
    const issue = makeIssue('memory-leak', {
      jsHeapSizeMB: 256,
      growthRate: '10MB/min',
    })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('256')
    expect(suggestion).toContain('10MB/min')
  })

  it('includes evidence data in resource-bloat output', () => {
    const issue = makeIssue('resource-bloat', {
      totalTransferKB: 5000,
      resourceCount: 150,
      jsTransferKB: 3000,
    })

    const suggestion = getSuggestion(issue)

    expect(suggestion).toContain('5000')
    expect(suggestion).toContain('150')
    expect(suggestion).toContain('3000')
  })
})
