import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMemoryLeakDetector } from '../memoryLeak.js'
import { resetIssueCounter } from '../createIssue.js'

// ── Mock performance.memory ──────────────────────────────────────────────────

interface MockPerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

const setupPerformanceMemory = (memory: MockPerformanceMemory): void => {
  Object.defineProperty(performance, 'memory', {
    value: memory,
    writable: true,
    configurable: true,
  })
}

const removePerformanceMemory = (): void => {
  // Remove the memory property if it was added
  if ('memory' in performance) {
    Object.defineProperty(performance, 'memory', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  }
}

describe('memoryLeak detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
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

    // Advance time — should not throw or create issues
    vi.advanceTimersByTime(60_000)
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should detect warning-level memory growth (10%+)', () => {
    const MB = 1024 * 1024
    let currentHeap = 50 * MB

    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() {
        return currentHeap
      },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()

    // Jump immediately above the recovery line (baseline*1.05 = 52.5MB)
    // then keep growing steadily to exceed 10% total growth
    currentHeap = 53 * MB // above recovery line from sample 1
    vi.advanceTimersByTime(5_000)

    currentHeap = 54 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 55 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 56 * MB // 12% growth from 50MB baseline
    vi.advanceTimersByTime(5_000)

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].detector).toBe('memory-leak')
    expect(issues[0].evidence).toHaveProperty('heapGrowthPct')
    expect(issues[0].evidence).toHaveProperty('baselineMB')
    expect(issues[0].evidence).toHaveProperty('currentMB')
    expect(issues[0].evidence).toHaveProperty('sampleCount')

    detector.stop()
  })

  it('should detect error-level memory growth (25%+)', () => {
    const MB = 1024 * 1024
    let currentHeap = 50 * MB

    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() {
        return currentHeap
      },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()

    // Jump above recovery line immediately, then grow aggressively
    currentHeap = 55 * MB // above recovery line (52.5MB)
    vi.advanceTimersByTime(5_000)

    currentHeap = 58 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 61 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 64 * MB // 28% growth from 50MB baseline
    vi.advanceTimersByTime(5_000)

    const issues = detector.getIssues()
    const errorIssue = issues.find((iss) => iss.severity === 'error')
    expect(errorIssue).toBeDefined()

    detector.stop()
  })

  it('should not flag when GC recovery occurs', () => {
    const MB = 1024 * 1024
    let currentHeap = 50 * MB

    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() {
        return currentHeap
      },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()

    // Grow then recover (simulate GC)
    currentHeap = 55 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 60 * MB
    vi.advanceTimersByTime(5_000)

    // GC kicks in — dips below baseline + 5%
    currentHeap = 49 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 56 * MB
    vi.advanceTimersByTime(5_000)

    // Should not report since recovery was detected
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should not flag stable memory', () => {
    const MB = 1024 * 1024
    const memory: MockPerformanceMemory = {
      usedJSHeapSize: 50 * MB,
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()

    // Advance through several sample intervals with stable heap
    for (let i = 0; i < 8; i++) {
      vi.advanceTimersByTime(5_000)
    }

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should clear issues and samples', () => {
    const MB = 1024 * 1024
    let currentHeap = 50 * MB

    const memory: MockPerformanceMemory = {
      get usedJSHeapSize() {
        return currentHeap
      },
      totalJSHeapSize: 100 * MB,
      jsHeapSizeLimit: 2048 * MB,
    }
    setupPerformanceMemory(memory)

    const detector = createMemoryLeakDetector()
    detector.start()

    // Jump above recovery line and grow past 25%
    currentHeap = 55 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 58 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 61 * MB
    vi.advanceTimersByTime(5_000)

    currentHeap = 64 * MB
    vi.advanceTimersByTime(5_000)

    expect(detector.getIssues().length).toBeGreaterThanOrEqual(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should stop cleanly and clear timer', () => {
    const MB = 1024 * 1024
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
})
