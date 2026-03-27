import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock setup ───────────────────────────────────────────────────────────────

const MOCK_MEMORY = {
  usedJSHeapSize: 50 * 1024 * 1024, // 50 MB
  totalJSHeapSize: 100 * 1024 * 1024, // 100 MB
  jsHeapSizeLimit: 200 * 1024 * 1024, // 200 MB limit
}

let memoryAvailable = true

vi.mock('../../utils/featureDetect.js', () => ({
  hasPerformanceMemory: () => memoryAvailable,
}))

const originalPerformance = globalThis.performance

const installMemoryMock = (
  overrides: Partial<typeof MOCK_MEMORY> = {}
): void => {
  const memory = { ...MOCK_MEMORY, ...overrides }
  memoryAvailable = true

  // Replace globalThis.performance with a proxy that has `memory`
  globalThis.performance = new Proxy(originalPerformance, {
    get(target, prop) {
      if (prop === 'memory') return memory
      const value = Reflect.get(target, prop)
      if (typeof value === 'function') {
        return value.bind(target)
      }
      return value
    },
    has(target, prop) {
      if (prop === 'memory') return true
      return Reflect.has(target, prop)
    },
  })
}

const removeMemoryMock = (): void => {
  memoryAvailable = false
  globalThis.performance = originalPerformance
}

// Must import after vi.mock
const { MemoryCollector, readHeapMemory } = await import('../memory.js')

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  installMemoryMock()
})

afterEach(() => {
  removeMemoryMock()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── readHeapMemory (pure function) ───────────────────────────────────────────

describe('readHeapMemory', () => {
  it('returns heap stats from performance.memory', () => {
    const stats = readHeapMemory()
    expect(stats).not.toBeNull()
    expect(stats?.jsHeapSizeMB).toBe(50)
    expect(stats?.totalHeapSizeMB).toBe(100)
    // 50MB used / 200MB limit = 25%
    expect(stats?.usedPct).toBe(25)
  })

  it('rounds values to 1 decimal place', () => {
    installMemoryMock({
      usedJSHeapSize: 33.33 * 1024 * 1024,
      totalJSHeapSize: 66.66 * 1024 * 1024,
      jsHeapSizeLimit: 200 * 1024 * 1024,
    })

    const stats = readHeapMemory()
    expect(stats).not.toBeNull()
    expect(stats?.jsHeapSizeMB).toBe(33.3)
    expect(stats?.totalHeapSizeMB).toBe(66.7)
  })

  it('returns null when performance.memory is unavailable', () => {
    removeMemoryMock()
    const stats = readHeapMemory()
    expect(stats).toBeNull()
  })
})

// ── MemoryCollector ──────────────────────────────────────────────────────────

describe('MemoryCollector', () => {
  it('returns null before starting', () => {
    const collector = new MemoryCollector()
    expect(collector.getStats()).toBeNull()
  })

  it('reads memory immediately on start', () => {
    const collector = new MemoryCollector()
    collector.start()

    const stats = collector.getStats()
    expect(stats).not.toBeNull()
    expect(stats?.jsHeapSizeMB).toBe(50)
    collector.stop()
  })

  it('polls at the configured interval', () => {
    const callback = vi.fn()
    const collector = new MemoryCollector(1000) // 1s interval
    collector.onUpdate(callback)
    collector.start()

    // Initial poll fires immediately
    expect(callback).toHaveBeenCalledTimes(1)

    // Advance by 1 second — should poll again
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(2)

    // Advance by another second
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(3)

    collector.stop()
  })

  it('uses default 2s poll interval', () => {
    const callback = vi.fn()
    const collector = new MemoryCollector()
    collector.onUpdate(callback)
    collector.start()

    expect(callback).toHaveBeenCalledTimes(1) // immediate

    vi.advanceTimersByTime(1999)
    expect(callback).toHaveBeenCalledTimes(1) // not yet

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(2) // at 2s

    collector.stop()
  })

  it('stops polling on stop()', () => {
    const callback = vi.fn()
    const collector = new MemoryCollector(500)
    collector.onUpdate(callback)
    collector.start()

    expect(callback).toHaveBeenCalledTimes(1)

    collector.stop()

    // Advance time — should NOT trigger more polls
    vi.advanceTimersByTime(5000)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('returns null after stop', () => {
    const collector = new MemoryCollector()
    collector.start()
    expect(collector.getStats()).not.toBeNull()

    collector.stop()
    expect(collector.getStats()).toBeNull()
  })

  it('returns null stats when performance.memory is missing', () => {
    removeMemoryMock()

    const collector = new MemoryCollector()
    collector.start()

    expect(collector.getStats()).toBeNull()
    collector.stop()
  })

  it('still starts successfully when memory API is missing', () => {
    removeMemoryMock()

    const collector = new MemoryCollector()
    // Should not throw
    collector.start()
    collector.stop()
  })

  it('unsubscribes callback via disposer', () => {
    const callback = vi.fn()
    const collector = new MemoryCollector(500)
    const unsub = collector.onUpdate(callback)
    unsub()

    collector.start()

    // Even immediate poll should not notify the unsubscribed callback
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(callback).not.toHaveBeenCalled()

    collector.stop()
  })

  it('reflects updated memory values on subsequent polls', () => {
    const collector = new MemoryCollector(1000)
    collector.start()

    expect(collector.getStats()?.jsHeapSizeMB).toBe(50)

    // Update mock to simulate heap growth
    installMemoryMock({
      usedJSHeapSize: 80 * 1024 * 1024,
    })

    vi.advanceTimersByTime(1000)
    expect(collector.getStats()?.jsHeapSizeMB).toBe(80)

    collector.stop()
  })

  it('does not double-start', () => {
    const callback = vi.fn()
    const collector = new MemoryCollector(1000)
    collector.onUpdate(callback)

    collector.start()
    collector.start() // second call should be a no-op

    expect(callback).toHaveBeenCalledTimes(1) // only 1 immediate poll

    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(2) // only 1 interval poll

    collector.stop()
  })

  it('can restart after stopping', () => {
    const collector = new MemoryCollector(1000)
    collector.start()
    expect(collector.getStats()).not.toBeNull()

    collector.stop()
    expect(collector.getStats()).toBeNull()

    // Re-install mock since removeMemoryMock may have been called
    installMemoryMock()
    collector.start()
    expect(collector.getStats()).not.toBeNull()

    collector.stop()
  })
})
