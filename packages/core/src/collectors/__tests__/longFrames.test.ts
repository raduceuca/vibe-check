import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EMPTY_LONG_FRAME_STATS } from '../../types.js'

// ── Mock feature detection ───────────────────────────────────────────────────

let loafSupported = true

vi.mock('../../utils/featureDetect.js', () => ({
  hasLongAnimationFrame: () => loafSupported,
}))

// ── PerformanceObserver mock ─────────────────────────────────────────────────

type PerfObsCallback = (list: { getEntries: () => PerformanceEntry[] }) => void

let observerCallback: PerfObsCallback | null = null
let observerInstance: {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} | null = null

const originalPerformanceObserver = globalThis.PerformanceObserver

const createMockPerformanceObserver = () => {
  const MockPO = class {
    static supportedEntryTypes = ['long-animation-frame']

    callback: PerfObsCallback
    observe: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    takeRecords: () => PerformanceEntry[]

    constructor(callback: PerfObsCallback) {
      this.callback = callback
      observerCallback = callback
      this.observe = vi.fn()
      this.disconnect = vi.fn()
      this.takeRecords = () => []
      observerInstance = this
    }
  }

  return MockPO as unknown as typeof PerformanceObserver
}

/**
 * Feed mock entries into the active observer.
 */
const feedEntries = (
  entries: Array<{
    duration: number
    startTime: number
    blockingDuration?: number
    scripts?: Array<{
      sourceURL?: string
      sourceFunctionName?: string
      duration?: number
    }>
  }>
): void => {
  if (!observerCallback) {
    throw new Error('No observer callback registered')
  }

  const perfEntries = entries.map((e) => ({
    duration: e.duration,
    startTime: e.startTime,
    blockingDuration: e.blockingDuration ?? 0,
    scripts: e.scripts ?? [],
    name: '',
    entryType: 'long-animation-frame',
    toJSON: () => ({}),
  }))

  observerCallback({
    getEntries: () => perfEntries as unknown as PerformanceEntry[],
  })
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  observerCallback = null
  observerInstance = null
  loafSupported = true
  globalThis.PerformanceObserver = createMockPerformanceObserver()
})

afterEach(() => {
  globalThis.PerformanceObserver = originalPerformanceObserver
  vi.restoreAllMocks()
})

// Must import after vi.mock is set up
const { LongFrameCollector } = await import('../longFrames.js')

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LongFrameCollector', () => {
  it('returns EMPTY stats before starting', () => {
    const collector = new LongFrameCollector()
    expect(collector.getStats()).toEqual(EMPTY_LONG_FRAME_STATS)
  })

  it('creates a PerformanceObserver on start', () => {
    const collector = new LongFrameCollector()
    collector.start()
    expect(observerInstance).not.toBeNull()
    expect(observerInstance?.observe).toHaveBeenCalledWith({
      type: 'long-animation-frame',
      buffered: true,
    })
    collector.stop()
  })

  it('disconnects observer on stop', () => {
    const collector = new LongFrameCollector()
    collector.start()
    const instance = observerInstance
    collector.stop()
    expect(instance?.disconnect).toHaveBeenCalled()
  })

  it('tracks count of long frames', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      { duration: 60, startTime: 100 },
      { duration: 80, startTime: 200 },
    ])

    expect(collector.getStats().count).toBe(2)

    feedEntries([{ duration: 55, startTime: 300 }])

    expect(collector.getStats().count).toBe(3)
    collector.stop()
  })

  it('captures entry details with rounding', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      {
        duration: 67.1234,
        startTime: 123.4567,
        blockingDuration: 45.6789,
      },
    ])

    const stats = collector.getStats()
    expect(stats.entries).toHaveLength(1)
    expect(stats.entries[0].duration).toBe(67.12)
    expect(stats.entries[0].startTime).toBe(123.46)
    expect(stats.entries[0].blockingDuration).toBe(45.68)
    collector.stop()
  })

  it('tracks the worst (longest) frame', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      { duration: 60, startTime: 100 },
      { duration: 120, startTime: 200 },
      { duration: 80, startTime: 300 },
    ])

    expect(collector.getStats().worstFrame).toBe(120)
    collector.stop()
  })

  it('preserves worst frame across batches', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([{ duration: 200, startTime: 100 }])
    feedEntries([{ duration: 80, startTime: 200 }])

    // The 200ms frame from the first batch is still the worst
    expect(collector.getStats().worstFrame).toBe(200)
    collector.stop()
  })

  it('caps entries at maxEntries', () => {
    const collector = new LongFrameCollector(3)
    collector.start()

    feedEntries([
      { duration: 60, startTime: 100 },
      { duration: 70, startTime: 200 },
      { duration: 80, startTime: 300 },
      { duration: 90, startTime: 400 },
      { duration: 100, startTime: 500 },
    ])

    const stats = collector.getStats()
    expect(stats.entries).toHaveLength(3)
    // Should keep the 3 most recent
    expect(stats.entries[0].duration).toBe(80)
    expect(stats.entries[1].duration).toBe(90)
    expect(stats.entries[2].duration).toBe(100)
    // But count includes all observed
    expect(stats.count).toBe(5)
    collector.stop()
  })

  it('parses scripts array for attribution', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      {
        duration: 75,
        startTime: 100,
        scripts: [
          {
            sourceURL: 'https://example.com/app.js',
            sourceFunctionName: 'heavyCompute',
            duration: 60,
          },
          {
            sourceURL: 'https://example.com/vendor.js',
            sourceFunctionName: 'parse',
            duration: 10,
          },
        ],
      },
    ])

    const entry = collector.getStats().entries[0]
    expect(entry.scripts).toHaveLength(2)
    expect(entry.scripts[0]).toEqual({
      sourceURL: 'https://example.com/app.js',
      sourceFunctionName: 'heavyCompute',
      duration: 60,
    })
    expect(entry.scripts[1]).toEqual({
      sourceURL: 'https://example.com/vendor.js',
      sourceFunctionName: 'parse',
      duration: 10,
    })
    collector.stop()
  })

  it('handles entries with no scripts array', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([{ duration: 55, startTime: 100 }])

    const entry = collector.getStats().entries[0]
    expect(entry.scripts).toEqual([])
    collector.stop()
  })

  it('handles scripts with missing fields gracefully', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      {
        duration: 60,
        startTime: 100,
        scripts: [
          { sourceURL: 'app.js' },
          { sourceFunctionName: 'foo' },
          {},
        ],
      },
    ])

    const scripts = collector.getStats().entries[0].scripts
    expect(scripts[0]).toEqual({
      sourceURL: 'app.js',
      sourceFunctionName: '',
      duration: 0,
    })
    expect(scripts[1]).toEqual({
      sourceURL: '',
      sourceFunctionName: 'foo',
      duration: 0,
    })
    expect(scripts[2]).toEqual({
      sourceURL: '',
      sourceFunctionName: '',
      duration: 0,
    })
    collector.stop()
  })

  it('clear() resets all state', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([
      { duration: 60, startTime: 100 },
      { duration: 120, startTime: 200 },
    ])

    expect(collector.getStats().count).toBe(2)

    collector.clear()

    const stats = collector.getStats()
    expect(stats.count).toBe(0)
    expect(stats.entries).toHaveLength(0)
    expect(stats.worstFrame).toBe(0)
    collector.stop()
  })

  it('fires callback on each batch of entries', () => {
    const collector = new LongFrameCollector()
    const callback = vi.fn()
    collector.onUpdate(callback)
    collector.start()

    feedEntries([{ duration: 60, startTime: 100 }])

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].count).toBe(1)

    feedEntries([{ duration: 80, startTime: 200 }])

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback.mock.calls[1][0].count).toBe(2)
    collector.stop()
  })

  it('unsubscribes callback via disposer', () => {
    const collector = new LongFrameCollector()
    const callback = vi.fn()
    const unsub = collector.onUpdate(callback)
    unsub()

    collector.start()
    feedEntries([{ duration: 60, startTime: 100 }])

    expect(callback).not.toHaveBeenCalled()
    collector.stop()
  })

  it('degrades gracefully when API is not available', () => {
    loafSupported = false

    const collector = new LongFrameCollector()
    collector.start()

    // Should not throw, should return empty stats
    expect(collector.getStats()).toEqual(EMPTY_LONG_FRAME_STATS)
    collector.stop()
  })

  it('returns EMPTY stats after stop even if entries were collected', () => {
    const collector = new LongFrameCollector()
    collector.start()

    feedEntries([{ duration: 60, startTime: 100 }])
    expect(collector.getStats().count).toBe(1)

    collector.stop()
    expect(collector.getStats()).toEqual(EMPTY_LONG_FRAME_STATS)
  })
})
