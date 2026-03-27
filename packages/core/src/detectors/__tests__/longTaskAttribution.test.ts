import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLongTaskAttributionDetector } from '../longTaskAttribution.js'
import { resetIssueCounter } from '../createIssue.js'

// ── Mock PerformanceObserver ─────────────────────────────────────────────────

type PerfObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void

let observerCallback: PerfObserverCallback | null = null
let observerDisconnected = false

class MockPerformanceObserver {
  constructor(cb: PerfObserverCallback) {
    observerCallback = cb
  }
  observe() {
    observerDisconnected = false
  }
  disconnect() {
    observerDisconnected = true
    observerCallback = null
  }
  takeRecords() {
    return []
  }
}

interface MockLoAFEntry {
  entryType: string
  name: string
  startTime: number
  duration: number
  scripts: { sourceURL: string; duration: number }[]
  toJSON: () => Record<string, unknown>
}

const createLoAFEntry = (
  scripts: { sourceURL: string; duration: number }[],
  duration = 60,
): MockLoAFEntry => ({
  entryType: 'long-animation-frame',
  name: '',
  startTime: performance.now(),
  duration,
  scripts,
  toJSON: () => ({}),
})

const simulateEntries = (entries: MockLoAFEntry[]): void => {
  if (!observerCallback) return
  observerCallback({ getEntries: () => entries as unknown as PerformanceEntry[] })
}

describe('longTaskAttribution detector', () => {
  const OriginalPerformanceObserver = globalThis.PerformanceObserver

  beforeEach(() => {
    resetIssueCounter()
    observerCallback = null
    observerDisconnected = false

    globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

    Object.defineProperty(globalThis.PerformanceObserver, 'supportedEntryTypes', {
      value: ['long-animation-frame'],
      configurable: true,
    })
  })

  afterEach(() => {
    globalThis.PerformanceObserver = OriginalPerformanceObserver
  })

  it('should have the correct name', () => {
    const detector = createLongTaskAttributionDetector()
    expect(detector.name).toBe('long-task-attribution')
  })

  it('should start with no issues', () => {
    const detector = createLongTaskAttributionDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should flag scripts that cause >3 long frames', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: 'https://example.com/heavy.js', duration: 80 }

    // Send 4 long frames with same script
    for (let i = 0; i < 4; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].detector).toBe('long-task-attribution')
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].evidence).toMatchObject({
      sourceURL: 'https://example.com/heavy.js',
      longFrameCount: 4,
    })
    expect(issues[0].evidence.totalBlockingMs).toBeGreaterThan(0)

    detector.stop()
  })

  it('should not flag scripts with 3 or fewer long frames', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: 'https://example.com/ok.js', duration: 60 }

    for (let i = 0; i < 3; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should track multiple scripts independently', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const scriptA = { sourceURL: 'https://example.com/a.js', duration: 70 }
    const scriptB = { sourceURL: 'https://example.com/b.js', duration: 50 }

    // 4 long frames for A, 2 for B
    for (let i = 0; i < 4; i++) {
      simulateEntries([createLoAFEntry([scriptA])])
    }
    for (let i = 0; i < 2; i++) {
      simulateEntries([createLoAFEntry([scriptB])])
    }

    const issues = detector.getIssues()
    expect(issues.length).toBe(1) // Only A should be flagged
    expect(issues[0].evidence).toHaveProperty('sourceURL', 'https://example.com/a.js')

    detector.stop()
  })

  it('should handle entries with multiple scripts', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const scriptA = { sourceURL: 'https://example.com/a.js', duration: 40 }
    const scriptB = { sourceURL: 'https://example.com/b.js', duration: 30 }

    // Send entries with both scripts
    for (let i = 0; i < 4; i++) {
      simulateEntries([createLoAFEntry([scriptA, scriptB])])
    }

    // Both should be flagged
    const issues = detector.getIssues()
    expect(issues.length).toBe(2)

    detector.stop()
  })

  it('should ignore entries with no scripts', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    simulateEntries([createLoAFEntry([])])

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should ignore scripts with empty sourceURL', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: '', duration: 80 }
    for (let i = 0; i < 5; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should only report each script once', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: 'https://example.com/heavy.js', duration: 80 }

    for (let i = 0; i < 10; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    // Should be exactly 1 issue (reported after frame 4, not again)
    expect(detector.getIssues().length).toBe(1)

    detector.stop()
  })

  it('should disconnect observer on stop()', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    expect(observerDisconnected).toBe(false)

    detector.stop()

    expect(observerDisconnected).toBe(true)
  })

  it('should clear issues and tracking state', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: 'https://example.com/heavy.js', duration: 80 }
    for (let i = 0; i < 4; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    expect(detector.getIssues().length).toBe(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should gracefully handle missing long-animation-frame support', () => {
    Object.defineProperty(globalThis.PerformanceObserver, 'supportedEntryTypes', {
      value: [],
      configurable: true,
    })

    const detector = createLongTaskAttributionDetector()
    detector.start() // Should not throw

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should accumulate total blocking time correctly', () => {
    const detector = createLongTaskAttributionDetector()
    detector.start()

    const script = { sourceURL: 'https://example.com/heavy.js', duration: 100 }

    for (let i = 0; i < 4; i++) {
      simulateEntries([createLoAFEntry([script])])
    }

    const issues = detector.getIssues()
    expect(issues[0].evidence.totalBlockingMs).toBe(400)

    detector.stop()
  })
})
