import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createResourceBloatDetector } from '../resourceBloat.js'
import { resetIssueCounter } from '../createIssue.js'

// ── Mock resource entries ────────────────────────────────────────────────────

interface MockResourceEntry {
  entryType: string
  name: string
  startTime: number
  duration: number
  transferSize: number
  initiatorType: string
  toJSON: () => Record<string, unknown>
}

const createResourceEntry = (
  url: string,
  transferSizeKB: number,
  initiatorType: string,
): MockResourceEntry => ({
  entryType: 'resource',
  name: url,
  startTime: 0,
  duration: 100,
  transferSize: transferSizeKB * 1024,
  initiatorType,
  toJSON: () => ({}),
})

describe('resourceBloat detector', () => {
  const originalGetEntries = performance.getEntriesByType
  let mockEntries: MockResourceEntry[] = []

  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
    mockEntries = []

    // Simulate production mode so threshold is 100KB (not 500KB dev mode)
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com' },
      writable: true,
      configurable: true,
    })

    // Mock getEntriesByType
    performance.getEntriesByType = vi.fn((type: string) => {
      if (type === 'resource') return mockEntries as unknown as PerformanceEntryList
      return originalGetEntries.call(performance, type)
    })

    // Mock PerformanceObserver.supportedEntryTypes for hasResourceTiming
    if (typeof PerformanceObserver !== 'undefined') {
      Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', {
        value: ['resource'],
        configurable: true,
      })
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    performance.getEntriesByType = originalGetEntries
  })

  it('should have the correct name', () => {
    const detector = createResourceBloatDetector()
    expect(detector.name).toBe('resource-bloat')
  })

  it('should start with no issues', () => {
    const detector = createResourceBloatDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should detect large JS resources over 100KB', () => {
    mockEntries = [
      createResourceEntry('https://example.com/vendor.js', 250, 'script'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].detector).toBe('resource-bloat')
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].evidence).toMatchObject({
      url: 'https://example.com/vendor.js',
      type: 'js',
    })
    expect((issues[0].evidence.transferSizeKB as number)).toBeGreaterThanOrEqual(250)

    detector.stop()
  })

  it('should detect large CSS resources over 100KB', () => {
    mockEntries = [
      createResourceEntry('https://example.com/styles.css', 150, 'css'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].evidence).toHaveProperty('type', 'css')

    detector.stop()
  })

  it('should not flag resources under 100KB', () => {
    mockEntries = [
      createResourceEntry('https://example.com/small.js', 50, 'script'),
      createResourceEntry('https://example.com/tiny.css', 10, 'css'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should not flag non-JS/CSS resources', () => {
    mockEntries = [
      createResourceEntry('https://example.com/image.png', 500, 'img'),
      createResourceEntry('https://example.com/font.woff2', 200, 'font'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should detect resources by URL extension when initiatorType is generic', () => {
    mockEntries = [
      createResourceEntry('https://example.com/chunk.mjs', 200, 'link'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].evidence).toHaveProperty('type', 'js')

    detector.stop()
  })

  it('should report each URL only once', () => {
    mockEntries = [
      createResourceEntry('https://example.com/vendor.js', 250, 'script'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    expect(detector.getIssues().length).toBe(1)

    // Advance past re-scan interval
    vi.advanceTimersByTime(10_000)

    // Should still be 1 issue
    expect(detector.getIssues().length).toBe(1)

    detector.stop()
  })

  it('should detect new resources on periodic re-scan', () => {
    mockEntries = [
      createResourceEntry('https://example.com/vendor.js', 250, 'script'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    expect(detector.getIssues().length).toBe(1)

    // Add a new large resource
    mockEntries = [
      ...mockEntries,
      createResourceEntry('https://example.com/lazy-chunk.js', 300, 'script'),
    ]

    vi.advanceTimersByTime(10_000)

    expect(detector.getIssues().length).toBe(2)

    detector.stop()
  })

  it('should clear issues and reported URLs', () => {
    mockEntries = [
      createResourceEntry('https://example.com/vendor.js', 250, 'script'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    expect(detector.getIssues().length).toBe(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should stop timer on stop()', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const detector = createResourceBloatDetector()
    detector.start()
    detector.stop()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('should handle multiple large resources in one scan', () => {
    mockEntries = [
      createResourceEntry('https://example.com/a.js', 200, 'script'),
      createResourceEntry('https://example.com/b.js', 150, 'script'),
      createResourceEntry('https://example.com/c.css', 120, 'css'),
      createResourceEntry('https://example.com/small.js', 50, 'script'),
    ]

    const detector = createResourceBloatDetector()
    detector.start()

    // 3 large resources (a.js, b.js, c.css). small.js is under threshold.
    expect(detector.getIssues().length).toBe(3)

    detector.stop()
  })

  it('should gracefully handle missing resource timing support', () => {
    if (typeof PerformanceObserver !== 'undefined') {
      Object.defineProperty(PerformanceObserver, 'supportedEntryTypes', {
        value: [],
        configurable: true,
      })
    }

    const detector = createResourceBloatDetector()
    detector.start() // Should not throw

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })
})
