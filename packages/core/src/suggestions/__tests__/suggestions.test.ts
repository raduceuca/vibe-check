import { describe, it, expect } from 'vitest'
import { getSuggestion, getAgentPrompt } from '../index.js'
import type { DetectorName, VibeIssue } from '../../types.js'

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

// Ground-truth evidence keys, exactly as emitted by each detector's createIssue().
// If a template reads a stale key, the real value won't render and the case fails.
const REAL_EVIDENCE: ReadonlyArray<{
  readonly detector: DetectorName
  readonly evidence: Record<string, unknown>
  readonly expected: readonly string[]
}> = [
  { detector: 'dom-bloat', evidence: { nodeCount: 8500, maxDepth: 22 }, expected: ['8500'] },
  { detector: 'duplicate-requests', evidence: { url: '/api/users', count: 5, method: 'GET' }, expected: ['/api/users', '5'] },
  { detector: 'console-spam', evidence: { method: 'log', callCount: 50, windowSeconds: 10, sampleArgs: ['a'] }, expected: ['50'] },
  { detector: 'memory-leak', evidence: { currentMB: 256, heapGrowthPct: 12, baselineMB: 200 }, expected: ['256', '12'] },
  { detector: 'layout-thrashing', evidence: { shiftCount: 7, totalShiftValue: 0.31, clusterDurationMs: 420 }, expected: ['7'] },
  { detector: 'unoptimized-images', evidence: { src: '/img/hero.png', problems: ['missing-lazy', 'missing-dimensions'] }, expected: ['hero.png', 'missing-dimensions'] },
  { detector: 'large-images', evidence: { src: '/img/big.png', transferSizeKB: 900, naturalWidth: 4000, naturalHeight: 3000, renderedWidth: 400, renderedHeight: 300 }, expected: ['900'] },
  { detector: 'long-task-attribution', evidence: { sourceURL: '/app.js', totalBlockingMs: 320, longFrameCount: 4 }, expected: ['/app.js', '320'] },
  { detector: 'resource-bloat', evidence: { url: '/vendor.js', transferSizeKB: 5000, type: 'script' }, expected: ['/vendor.js', '5000', 'script'] },
  { detector: 'web-essentials', evidence: { check: 'missing-viewport' }, expected: ['missing-viewport'] },
  { detector: 'heavy-library', evidence: { library: 'Moment', packageName: 'moment', bundleSizeKB: 290, knownIssues: ['no tree-shaking'] }, expected: ['Moment', '290'] },
  { detector: 'seo', evidence: { check: 'meta-description-missing' }, expected: ['description'] },
  { detector: 'aeo', evidence: { check: 'structured-data-missing' }, expected: ['JSON-LD'] },
]

describe('getSuggestion — no evidence-key drift', () => {
  it.each(REAL_EVIDENCE)('renders real evidence for $detector (technical)', ({ detector, evidence, expected }) => {
    const s = getSuggestion(makeIssue(detector, evidence), 'technical')
    const text = `${s.title}\n${s.explanation}\n${s.prompt}`
    for (const value of expected) {
      expect(text).toContain(value)
    }
  })

  it.each(REAL_EVIDENCE)('renders real evidence for $detector (vibe)', ({ detector, evidence }) => {
    // Vibe mode must also not throw and must produce a non-empty prompt.
    const s = getSuggestion(makeIssue(detector, evidence), 'vibe')
    expect(s.prompt.length).toBeGreaterThan(0)
  })

  it('long-task explanation uses totalBlockingMs, not the never-emitted `duration` key (#8)', () => {
    const s = getSuggestion(
      makeIssue('long-task-attribution', { sourceURL: '/app.js', totalBlockingMs: 320 }),
      'technical',
    )
    expect(s.explanation).toContain('320')
    // The old bug rendered "blocked main thread for ?ms".
    expect(s.explanation).not.toContain('?ms')
  })
})

describe('SEO/AEO vibe voice (no raw jargon in vibe mode)', () => {
  it('rewrites og-title-missing into plain language', () => {
    const s = getSuggestion(makeIssue('seo', { check: 'og-title-missing' }), 'vibe')
    expect(s.title).toBe("Shared links don't get their own title")
    expect(s.explanation).toContain('platforms fall back to the tab title')
  })

  it('rewrites canonical-missing into plain language', () => {
    const s = getSuggestion(makeIssue('seo', { check: 'canonical-missing' }), 'vibe')
    expect(s.title).toBe('Google may see this page as duplicates')
  })

  it('rewrites structured-data-missing and mentions JSON-LD', () => {
    const s = getSuggestion(makeIssue('aeo', { check: 'structured-data-missing' }), 'vibe')
    expect(s.title.toLowerCase()).toContain('guess')
    expect(s.explanation).toContain('JSON-LD')
  })

  it('falls back to the issue title for an unknown seo check', () => {
    const issue = makeIssue('seo', { check: 'some-future-check' })
    const s = getSuggestion(issue, 'vibe')
    expect(s.title).toBe(issue.title)
  })
})

describe('image titles never surface a bare numeric path', () => {
  it('unoptimized-images with an extensionless URL uses host + dimensions', () => {
    const evidence = { src: 'https://picsum.photos/2400/1200', problems: ['missing-dimensions'], naturalWidth: 2400, naturalHeight: 1200 }
    const vibe = getSuggestion(makeIssue('unoptimized-images', evidence), 'vibe')
    const tech = getSuggestion(makeIssue('unoptimized-images', evidence), 'technical')
    expect(vibe.title).not.toContain('2400/1200')
    expect(tech.title).not.toContain('2400/1200')
    expect(vibe.title).toContain('picsum.photos')
    expect(vibe.title).toContain('2400×1200')
  })

  it('large-images with an extensionless URL uses dimensions, not "1200"', () => {
    const evidence = { src: 'https://picsum.photos/2400/1200', transferSizeKB: 900, naturalWidth: 2400, naturalHeight: 1200, renderedWidth: 400, renderedHeight: 200 }
    const s = getSuggestion(makeIssue('large-images', evidence), 'vibe')
    expect(s.title).toContain('2400×1200 image')
    expect(s.title).toContain('900')
    expect(s.title).not.toMatch(/^1200/)
  })

  it('keeps a real filename when the URL has one', () => {
    const evidence = { src: '/img/hero.png', problems: ['missing-dimensions'] }
    const s = getSuggestion(makeIssue('unoptimized-images', evidence), 'vibe')
    expect(s.title.toLowerCase()).toContain('hero.png')
  })
})

describe('copy-all header is category-neutral', () => {
  const seoIssue = makeIssue('seo', { check: 'og-title-missing' })

  it('does not label the batch a set of performance issues', () => {
    const out = getAgentPrompt([seoIssue], 'technical')
    expect(out).not.toContain('# Performance Issues Detected by Vibe Check')
    expect(out.toLowerCase()).toContain('search visibility')
  })

  it('vibe header is neutral too', () => {
    const out = getAgentPrompt([seoIssue], 'vibe')
    expect(out).not.toContain('Performance Problems Found')
  })
})
