import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VibeCheckEngine } from '../engine.js'

// Mock all browser APIs that collectors/detectors need
beforeEach(() => {
  vi.useFakeTimers()

  // Mock requestAnimationFrame
  let rafId = 0
  globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    rafId += 1
    setTimeout(() => cb(performance.now()), 16)
    return rafId
  })
  globalThis.cancelAnimationFrame = vi.fn((id: number) => {
    clearTimeout(id)
  })

  // Mock PerformanceObserver
  globalThis.PerformanceObserver = class MockPerformanceObserver {
    static supportedEntryTypes: string[] = []
    constructor(_callback: PerformanceObserverCallback) {}
    observe() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof PerformanceObserver

  // Mock document.querySelectorAll
  const mockNodeList = { length: 100 }
  vi.spyOn(document, 'querySelectorAll').mockReturnValue(
    mockNodeList as unknown as NodeListOf<Element>
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('VibeCheckEngine', () => {
  it('creates with default config', () => {
    const engine = new VibeCheckEngine()
    expect(engine.isRunning()).toBe(false)
  })

  it('creates with partial config', () => {
    const engine = new VibeCheckEngine({
      beaconUrl: 'http://localhost:4200',
      detectors: {
        domBloat: false,
        consoleSpam: false,
        duplicateRequests: true,
        memoryLeak: true,
        layoutThrashing: true,
        unoptimizedImages: true,
        longTaskAttribution: true,
        resourceBloat: true,
      },
    })
    expect(engine.isRunning()).toBe(false)
  })

  it('starts and stops cleanly', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()
    expect(engine.isRunning()).toBe(true)

    engine.stop()
    expect(engine.isRunning()).toBe(false)
  })

  it('start is idempotent', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()
    engine.start() // Should not throw or double-start
    expect(engine.isRunning()).toBe(true)

    engine.stop()
  })

  it('stop is idempotent', () => {
    const engine = new VibeCheckEngine()

    engine.stop() // Should not throw when not started
    expect(engine.isRunning()).toBe(false)
  })

  it('getSnapshot returns valid structure', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()

    const snapshot = engine.getSnapshot()

    expect(snapshot).toHaveProperty('timestamp')
    expect(snapshot).toHaveProperty('frameRate')
    expect(snapshot).toHaveProperty('longFrames')
    expect(snapshot).toHaveProperty('webVitals')
    expect(snapshot).toHaveProperty('memory')
    expect(snapshot).toHaveProperty('resources')
    expect(snapshot).toHaveProperty('issues')
    expect(snapshot).toHaveProperty('domNodeCount')
    expect(typeof snapshot.timestamp).toBe('number')
    expect(Array.isArray(snapshot.issues)).toBe(true)

    engine.stop()
  })

  it('getSnapshot returns empty data when not started', () => {
    const engine = new VibeCheckEngine()

    const snapshot = engine.getSnapshot()

    expect(snapshot.frameRate.fps).toBe(0)
    expect(snapshot.longFrames.count).toBe(0)
    expect(snapshot.webVitals.lcp).toBeNull()
    expect(snapshot.memory).toBeNull()
    expect(snapshot.issues).toHaveLength(0)
  })

  it('getIssues returns empty array with no detectors', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()
    expect(engine.getIssues()).toHaveLength(0)
    engine.stop()
  })

  it('clearIssues does not throw when no detectors', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()
    expect(() => engine.clearIssues()).not.toThrow()
    engine.stop()
  })

  it('onSnapshot registers and unregisters callbacks', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    const callback = vi.fn()

    engine.start()
    const unsubscribe = engine.onSnapshot(callback)

    // Advance 500ms to trigger snapshot callback
    vi.advanceTimersByTime(500)
    expect(callback).toHaveBeenCalled()

    const callCount = callback.mock.calls.length
    unsubscribe()

    vi.advanceTimersByTime(500)
    // No more calls after unsubscribe
    expect(callback.mock.calls.length).toBe(callCount)

    engine.stop()
  })

  it('domNodeCount reflects document state', () => {
    const engine = new VibeCheckEngine({
      detectors: {
        domBloat: false,
        duplicateRequests: false,
        consoleSpam: false,
        memoryLeak: false,
        layoutThrashing: false,
        unoptimizedImages: false,
        longTaskAttribution: false,
        resourceBloat: false,
        largeImages: false,
        webEssentials: false,
      },
    })

    engine.start()
    const snapshot = engine.getSnapshot()
    expect(snapshot.domNodeCount).toBe(100)
    engine.stop()
  })
})
