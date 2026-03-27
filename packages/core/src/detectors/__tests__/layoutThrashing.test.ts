import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLayoutThrashingDetector } from '../layoutThrashing.js'
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

const simulateLayoutShifts = (
  count: number,
  hadRecentInput: boolean,
  value = 0.05,
): void => {
  if (!observerCallback) return

  const entries = Array.from({ length: count }, () => ({
    entryType: 'layout-shift',
    name: '',
    startTime: performance.now(),
    duration: 0,
    toJSON: () => ({}),
    hadRecentInput,
    value,
  }))

  observerCallback({ getEntries: () => entries })
}

describe('layoutThrashing detector', () => {
  const OriginalPerformanceObserver = globalThis.PerformanceObserver

  beforeEach(() => {
    resetIssueCounter()
    observerCallback = null
    observerDisconnected = false

    // Mock PerformanceObserver
    globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

    // Mock supportedEntryTypes
    Object.defineProperty(globalThis.PerformanceObserver, 'supportedEntryTypes', {
      value: ['layout-shift'],
      configurable: true,
    })
  })

  afterEach(() => {
    globalThis.PerformanceObserver = OriginalPerformanceObserver
  })

  it('should have the correct name', () => {
    const detector = createLayoutThrashingDetector()
    expect(detector.name).toBe('layout-thrashing')
  })

  it('should start with no issues', () => {
    const detector = createLayoutThrashingDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should detect cluster of 3+ unexpected layout shifts', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    // Simulate 3 shifts without user input (cluster)
    simulateLayoutShifts(3, false, 0.1)

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].detector).toBe('layout-thrashing')
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].evidence).toHaveProperty('shiftCount', 3)
    expect(issues[0].evidence).toHaveProperty('totalShiftValue')
    expect(issues[0].evidence).toHaveProperty('clusterDurationMs')

    detector.stop()
  })

  it('should ignore shifts caused by user input', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    // Simulate 5 shifts WITH user input
    simulateLayoutShifts(5, true)

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should not flag fewer than 3 shifts', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    simulateLayoutShifts(2, false)

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should disconnect observer on stop()', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    expect(observerDisconnected).toBe(false)

    detector.stop()

    expect(observerDisconnected).toBe(true)
  })

  it('should clear issues', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    simulateLayoutShifts(3, false)
    expect(detector.getIssues().length).toBe(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should gracefully handle missing PerformanceObserver support', () => {
    // Remove layout-shift from supported types
    Object.defineProperty(globalThis.PerformanceObserver, 'supportedEntryTypes', {
      value: [],
      configurable: true,
    })

    const detector = createLayoutThrashingDetector()
    detector.start()

    // Should not throw, just not create observer
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should accumulate shift values correctly', () => {
    const detector = createLayoutThrashingDetector()
    detector.start()

    simulateLayoutShifts(4, false, 0.25)

    const issues = detector.getIssues()
    // First 3 shifts trigger cluster (3 * 0.25 = 0.75), cluster resets, 4th shift starts new cluster
    expect(issues.length).toBe(1)

    const totalValue = issues[0].evidence.totalShiftValue as number
    expect(totalValue).toBeCloseTo(0.75, 2)

    detector.stop()
  })
})
