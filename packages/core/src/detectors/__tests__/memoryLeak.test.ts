import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryLeakDetector, analyzeHeapFloors } from '../memoryLeak.js'
import { resetIssueCounter } from '../createIssue.js'

interface MockPerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

const MB = 1024 * 1024

const setupPerformanceMemory = (memory: MockPerformanceMemory): void => {
  Object.defineProperty(performance, 'memory', {
    value: memory,
    writable: true,
    configurable: true,
  })
  // Pretend the page has already passed the 30s warm-up.
  Object.defineProperty(performance, 'timeOrigin', {
    value: Date.now() - 60_000,
    writable: true,
    configurable: true,
  })
}

const removePerformanceMemory = (): void => {
  if ('memory' in performance) {
    Object.defineProperty(performance, 'memory', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  }
}

/**
 * Drive four 30s slices (120s window) with a rising floor in each.
 * Samples every 5s; each slice gets a constant heap so its floor is that value.
 */
const riseAcrossWindow = (
  setHeap: (mb: number) => void,
  floorsMb: readonly number[],
): void => {
  for (const floor of floorsMb) {
    setHeap(floor)
    // 30s slice / 5s interval = 6 samples (≥ MIN_SAMPLES_PER_SLICE)
    for (let i = 0; i < 6; i += 1) vi.advanceTimersByTime(5_000)
  }
}

describe('analyzeHeapFloors', () => {
  it('flags a steadily rising floor and ignores a sawtooth', () => {
    expect(analyzeHeapFloors([50, 55, 60, 66]).rising).toBe(true)
    expect(analyzeHeapFloors([50, 60, 45, 70]).rising).toBe(false)
    expect(analyzeHeapFloors([50, 50.1, 50.2, 50.3]).rising).toBe(false)
  })
})

describe('memoryLeak detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    removePerformanceMemory()
  })

  it('should have the correct name', () => {
    const detector = createMemoryLeakDetector()
    expect(detector.name).toBe('memory-leak')
  })

  it('should start with no issues', () => {
    const detector = createMemoryLeakDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should not start when performance.memory is unavailable', () => {
    removePerformanceMemory()

    const detector = createMemoryLeakDetector()
    detector.start()

    vi.advanceTimersByTime(180_000)
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should detect warning-level memory growth (10%+ rising floor)', () => {
    let currentHeap = 50 * MB
    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() { return currentHeap },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()
    riseAcrossWindow((mb) => { currentHeap = mb * MB }, [50, 54, 58, 62])

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues[0]!.severity).toBe('warning')
    expect(issues[0]!.detector).toBe('memory-leak')
    expect(issues[0]!.evidence).toHaveProperty('heapGrowthPct')
    expect(issues[0]!.evidence).toHaveProperty('baselineMB')
    expect(issues[0]!.evidence).toHaveProperty('currentMB')
    expect(issues[0]!.evidence).toHaveProperty('sampleCount')

    detector.stop()
  })

  it('should detect error-level memory growth (25%+)', () => {
    let currentHeap = 50 * MB
    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() { return currentHeap },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()
    riseAcrossWindow((mb) => { currentHeap = mb * MB }, [50, 58, 66, 75])

    const issues = detector.getIssues()
    const errorIssue = issues.find((iss) => iss.severity === 'error')
    expect(errorIssue).toBeDefined()

    detector.stop()
  })

  it('should not flag when a later slice drops (GC recovery)', () => {
    let currentHeap = 50 * MB
    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() { return currentHeap },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()
    // Slice floors rise then fall — not a leak.
    riseAcrossWindow((mb) => { currentHeap = mb * MB }, [50, 60, 70, 45])

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should not flag stable memory', () => {
    const memory: MockPerformanceMemory = {
      usedJSHeapSize: 50 * MB,
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()
    riseAcrossWindow(() => undefined, [50, 50, 50, 50])

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should clear issues and samples', () => {
    let currentHeap = 50 * MB
    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() { return currentHeap },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()
    riseAcrossWindow((mb) => { currentHeap = mb * MB }, [50, 58, 66, 75])

    expect(detector.getIssues().length).toBeGreaterThanOrEqual(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should stop cleanly and clear timer', () => {
    const memory: MockPerformanceMemory = {
      usedJSHeapSize: 50 * MB,
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const detector = createMemoryLeakDetector()
    detector.start()
    detector.stop()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('exposes getStatus once sampling has settled', () => {
    const memory: MockPerformanceMemory = {
      usedJSHeapSize: 50 * MB,
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)
    const detector = createMemoryLeakDetector()
    detector.start()
    riseAcrossWindow(() => undefined, [50, 50, 50, 50])
    const status = detector.getStatus?.()
    expect(status).toMatchObject({
      detector: 'memory-leak',
      kind: 'continuous',
      settledAt: expect.any(Number),
      evaluatedAt: expect.any(Number),
    })
    detector.stop()
  })
})
