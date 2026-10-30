import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock feature detection to return true by default (overridden per test as needed)
vi.mock('../../utils/featureDetect.js', () => ({
  hasLargestContentfulPaint: vi.fn(() => true),
  hasEventTiming: vi.fn(() => true),
  hasLayoutShift: vi.fn(() => true),
}))

import { WebVitalsCollector, computeInp, recordInteraction } from '../webVitals.js'
import { hasLargestContentfulPaint, hasEventTiming, hasLayoutShift } from '../../utils/featureDetect.js'

type ObserverCallback = (list: { getEntries: () => unknown[] }) => void

let observerCallbacks: Map<string, ObserverCallback>
let disconnectSpy: ReturnType<typeof vi.fn>

const createMockPerformanceObserver = () => {
  observerCallbacks = new Map()
  disconnectSpy = vi.fn()

  return class MockPerformanceObserver {
    static supportedEntryTypes = ['largest-contentful-paint', 'event', 'layout-shift']
    private readonly callback: ObserverCallback

    constructor(callback: ObserverCallback) {
      this.callback = callback
    }

    observe(options: { type: string }) {
      observerCallbacks.set(options.type, this.callback)
    }

    disconnect() {
      disconnectSpy()
      for (const [key, cb] of observerCallbacks) {
        if (cb === this.callback) {
          observerCallbacks.delete(key)
        }
      }
    }
  }
}

const triggerEntries = (type: string, entries: unknown[]) => {
  const cb = observerCallbacks.get(type)
  cb?.({ getEntries: () => entries })
}

// One event entry for a new interaction. Chrome's interaction ids grow (in
// steps of 7); entries with interactionId 0 are not interactions (hover etc.).
let nextInteractionId = 7
const interaction = (duration: number, interactionId?: number) => {
  const id = interactionId ?? nextInteractionId
  if (interactionId === undefined) nextInteractionId += 7
  return { name: 'pointerdown', duration, interactionId: id }
}

describe('WebVitalsCollector', () => {
  beforeEach(() => {
    vi.stubGlobal('PerformanceObserver', createMockPerformanceObserver())
    vi.mocked(hasLargestContentfulPaint).mockReturnValue(true)
    vi.mocked(hasEventTiming).mockReturnValue(true)
    vi.mocked(hasLayoutShift).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('returns all nulls before start', () => {
      const collector = new WebVitalsCollector()
      const stats = collector.getStats()

      expect(stats.lcp).toBeNull()
      expect(stats.inp).toBeNull()
      expect(stats.cls).toBeNull()
    })
  })

  describe('LCP', () => {
    it('tracks the last LCP entry, not the first', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [
        { startTime: 800, size: 100 },
        { startTime: 1200, size: 500 },
        { startTime: 2000, size: 300 },
      ])

      const stats = collector.getStats()
      expect(stats.lcp).not.toBeNull()
      expect(stats.lcp?.value).toBe(2000)
    })

    it('updates LCP when new entries arrive', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 1000, size: 200 }])
      expect(collector.getStats().lcp?.value).toBe(1000)

      triggerEntries('largest-contentful-paint', [{ startTime: 1800, size: 400 }])
      expect(collector.getStats().lcp?.value).toBe(1800)
    })

    it('rates good when LCP <= 2500ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 2500, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('good')
    })

    it('rates good for fast LCP', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 1200, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('good')
    })

    it('rates needs-improvement when 2500 < LCP <= 4000ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 3000, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('needs-improvement')
    })

    it('rates needs-improvement at boundary (4000ms)', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 4000, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('needs-improvement')
    })

    it('rates poor when LCP > 4000ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 4001, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('poor')
    })

    it('rates poor for very slow LCP', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 8000, size: 100 }])
      expect(collector.getStats().lcp?.rating).toBe('poor')
    })

    it('returns null LCP when API is unavailable', () => {
      vi.mocked(hasLargestContentfulPaint).mockReturnValue(false)

      const collector = new WebVitalsCollector()
      collector.start()

      expect(collector.getStats().lcp).toBeNull()
    })
  })

  describe('INP', () => {
    it('computes P98 from event durations', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // Create 100 events: 98 at 50ms, 1 at 300ms, 1 at 600ms
      const entries = []
      for (let i = 0; i < 98; i++) {
        entries.push(interaction(50))
      }
      entries.push(interaction(300))
      entries.push(interaction(600))

      triggerEntries('event', entries)

      const stats = collector.getStats()
      expect(stats.inp).not.toBeNull()
      // 100 interactions: ignore the 2 longest (one per 50) -> 50
      expect(stats.inp?.value).toBe(50)
    })

    it('selects correct P98 with distinct durations', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // 50 events: 48 at 100ms, 1 at 300ms, 1 at 600ms
      const entries = []
      for (let i = 0; i < 48; i++) {
        entries.push(interaction(100))
      }
      entries.push(interaction(300))
      entries.push(interaction(600))

      triggerEntries('event', entries)

      const stats = collector.getStats()
      expect(stats.inp).not.toBeNull()
      // 50 interactions: ignore the longest one -> 300
      expect(stats.inp?.value).toBe(300)
    })

    it('handles a single event entry', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(150)])

      const stats = collector.getStats()
      expect(stats.inp?.value).toBe(150)
    })

    it('accumulates events across multiple observer callbacks', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(100), interaction(200)])
      triggerEntries('event', [interaction(300)])

      const stats = collector.getStats()
      // 3 interactions: the longest counts -> 300
      expect(stats.inp?.value).toBe(300)
    })

    it('rates good when INP <= 200ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(200)])
      expect(collector.getStats().inp?.rating).toBe('good')
    })

    it('rates good for fast interactions', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(50)])
      expect(collector.getStats().inp?.rating).toBe('good')
    })

    it('rates needs-improvement when 200 < INP <= 500ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(350)])
      expect(collector.getStats().inp?.rating).toBe('needs-improvement')
    })

    it('rates needs-improvement at boundary (500ms)', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(500)])
      expect(collector.getStats().inp?.rating).toBe('needs-improvement')
    })

    it('rates poor when INP > 500ms', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(501)])
      expect(collector.getStats().inp?.rating).toBe('poor')
    })

    it('rates poor for very slow interactions', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [interaction(1200)])
      expect(collector.getStats().inp?.rating).toBe('poor')
    })

    // C9: a slow hover handler is not an interaction.
    it('ignores event entries that are not interactions (interactionId 0)', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [
        { name: 'pointerover', duration: 320, interactionId: 0 },
        { name: 'mouseover', duration: 320, interactionId: 0 },
        { name: 'pointerenter', duration: 312 },
        interaction(16, 4460),
        interaction(16, 4460),
      ])

      expect(collector.getStats().inp).toEqual({ value: 16, rating: 'good' })
    })

    it('returns null INP while only hover events have been seen', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('event', [{ name: 'mouseover', duration: 400, interactionId: 0 }])

      expect(collector.getStats().inp).toBeNull()
    })

    it('counts each interaction once, at its longest entry', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // pointerdown / pointerup / click of ONE interaction, then 49 fast ones.
      triggerEntries('event', [interaction(40, 1), interaction(120, 1), interaction(80, 1)])
      for (let i = 0; i < 49; i++) triggerEntries('event', [interaction(24)])

      // 50 interactions: the single 120 ms interaction is the ignored outlier.
      expect(collector.getStats().inp?.value).toBe(24)
    })

    it('prefers the browser interaction count when it is exposed', () => {
      Object.defineProperty(performance, 'interactionCount', { configurable: true, value: 100 })
      try {
        const collector = new WebVitalsCollector()
        collector.start()
        triggerEntries('event', [interaction(600), interaction(300), interaction(90)])
        // 100 interactions (most too fast for an entry): ignore the 2 longest -> 90
        expect(collector.getStats().inp?.value).toBe(90)
      } finally {
        delete (performance as { interactionCount?: number }).interactionCount
      }
    })

    it('keeps only the 10 longest interactions in memory', () => {
      let longest: ReturnType<typeof recordInteraction> = []
      for (let id = 1; id <= 500; id++) longest = recordInteraction(longest, id, id % 97)
      expect(longest).toHaveLength(10)
      expect(longest.map((sample) => sample.duration)).toEqual([96, 96, 96, 96, 96, 95, 95, 95, 95, 95])
    })

    it('updates an interaction in place when a longer entry for it arrives', () => {
      const first = recordInteraction([], 7, 40)
      const same = recordInteraction(first, 7, 30)
      const longer = recordInteraction(first, 7, 90)
      expect(same).toBe(first)
      expect(longer).toEqual([{ id: 7, duration: 90 }])
      expect(first).toEqual([{ id: 7, duration: 40 }])
    })

    it('computes INP as the longest interaction after ignoring one per 50', () => {
      const longest = [600, 300, 200, 100].map((duration, index) => ({ id: index + 1, duration }))
      expect(computeInp([], 0)).toBeNull()
      expect(computeInp(longest, 4)).toBe(600)
      expect(computeInp(longest, 50)).toBe(300)
      expect(computeInp(longest, 149)).toBe(200)
      expect(computeInp(longest, 10_000)).toBe(100)
    })

    it('returns null INP when API is unavailable', () => {
      vi.mocked(hasEventTiming).mockReturnValue(false)

      const collector = new WebVitalsCollector()
      collector.start()

      expect(collector.getStats().inp).toBeNull()
    })
  })

  describe('CLS', () => {
    it('computes CLS from a single session window', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.05, startTime: 1000, hadRecentInput: false },
        { value: 0.03, startTime: 1500, hadRecentInput: false },
        { value: 0.02, startTime: 2000, hadRecentInput: false },
      ])

      const stats = collector.getStats()
      expect(stats.cls).not.toBeNull()
      expect(stats.cls?.value).toBeCloseTo(0.10)
    })

    it('groups shifts by session window (gap <= 1s, window <= 5s)', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // Window 1: shifts at 1000, 1500, 2000 -> sum = 0.10
      // Gap > 1s between 2000 and 4000
      // Window 2: shifts at 4000, 4800 -> sum = 0.15
      triggerEntries('layout-shift', [
        { value: 0.03, startTime: 1000, hadRecentInput: false },
        { value: 0.04, startTime: 1500, hadRecentInput: false },
        { value: 0.03, startTime: 2000, hadRecentInput: false },
        { value: 0.10, startTime: 4000, hadRecentInput: false },
        { value: 0.05, startTime: 4800, hadRecentInput: false },
      ])

      const stats = collector.getStats()
      // CLS = max window sum = 0.15
      expect(stats.cls?.value).toBeCloseTo(0.15)
    })

    it('starts a new window when the 5s max duration is exceeded', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // All entries within 1s gap but spanning > 5s total
      // Window 1: 0, 900, 1800, 2700, 3600, 4500 -> 5s window (4500-0=4500, within 5s)
      // Entry at 5500: gap from 4500 = 1000ms (within 1s), but 5500-0 = 5500 > 5000ms
      // So it starts a new window
      triggerEntries('layout-shift', [
        { value: 0.01, startTime: 0, hadRecentInput: false },
        { value: 0.01, startTime: 900, hadRecentInput: false },
        { value: 0.01, startTime: 1800, hadRecentInput: false },
        { value: 0.01, startTime: 2700, hadRecentInput: false },
        { value: 0.01, startTime: 3600, hadRecentInput: false },
        { value: 0.01, startTime: 4500, hadRecentInput: false },
        { value: 0.50, startTime: 5500, hadRecentInput: false },
      ])

      const stats = collector.getStats()
      // Window 1: sum = 0.06 (6 entries * 0.01)
      // Window 2: sum = 0.50
      // CLS = max = 0.50
      expect(stats.cls?.value).toBeCloseTo(0.50)
    })

    it('excludes entries with hadRecentInput=true', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.05, startTime: 1000, hadRecentInput: false },
        { value: 0.50, startTime: 1500, hadRecentInput: true },
        { value: 0.03, startTime: 2000, hadRecentInput: false },
      ])

      const stats = collector.getStats()
      // Only entries without recent input: 0.05 + 0.03 = 0.08
      expect(stats.cls?.value).toBeCloseTo(0.08)
    })

    it('returns 0 CLS when all entries have hadRecentInput=true', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.50, startTime: 1000, hadRecentInput: true },
        { value: 0.30, startTime: 2000, hadRecentInput: true },
      ])

      const stats = collector.getStats()
      // layoutShiftEntries is non-empty, but computeCLS filters all -> returns 0
      expect(stats.cls?.value).toBe(0)
    })

    it('rates good when CLS <= 0.1', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.05, startTime: 1000, hadRecentInput: false },
        { value: 0.05, startTime: 1500, hadRecentInput: false },
      ])

      expect(collector.getStats().cls?.rating).toBe('good')
    })

    it('rates needs-improvement when 0.1 < CLS <= 0.25', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.15, startTime: 1000, hadRecentInput: false },
      ])

      expect(collector.getStats().cls?.rating).toBe('needs-improvement')
    })

    it('rates poor when CLS > 0.25', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('layout-shift', [
        { value: 0.30, startTime: 1000, hadRecentInput: false },
      ])

      expect(collector.getStats().cls?.rating).toBe('poor')
    })

    it('returns null CLS when API is unavailable', () => {
      vi.mocked(hasLayoutShift).mockReturnValue(false)

      const collector = new WebVitalsCollector()
      collector.start()

      expect(collector.getStats().cls).toBeNull()
    })
  })

  describe('integration', () => {
    it('returns all three vitals when all observers fire', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      triggerEntries('largest-contentful-paint', [{ startTime: 1500, size: 200 }])
      triggerEntries('event', [interaction(120)])
      triggerEntries('layout-shift', [
        { value: 0.02, startTime: 1000, hadRecentInput: false },
      ])

      const stats = collector.getStats()

      expect(stats.lcp).not.toBeNull()
      expect(stats.lcp?.value).toBe(1500)
      expect(stats.lcp?.rating).toBe('good')

      expect(stats.inp).not.toBeNull()
      expect(stats.inp?.value).toBe(120)
      expect(stats.inp?.rating).toBe('good')

      expect(stats.cls).not.toBeNull()
      expect(stats.cls?.value).toBeCloseTo(0.02)
      expect(stats.cls?.rating).toBe('good')
    })

    it('stop() disconnects all observers', () => {
      const collector = new WebVitalsCollector()
      collector.start()

      // 3 observers should have been created (LCP, INP, CLS)
      expect(observerCallbacks.size).toBe(3)

      collector.stop()

      expect(disconnectSpy).toHaveBeenCalledTimes(3)
    })

    it('onUpdate fires callback when vitals change', () => {
      const collector = new WebVitalsCollector()
      const callback = vi.fn()

      collector.start()
      const unsubscribe = collector.onUpdate(callback)

      triggerEntries('largest-contentful-paint', [{ startTime: 1000, size: 100 }])

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          lcp: expect.objectContaining({ value: 1000 }),
        }),
      )

      unsubscribe()
      triggerEntries('largest-contentful-paint', [{ startTime: 2000, size: 100 }])

      // Should not have been called again after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('returns all nulls when no observer types are supported', () => {
      vi.mocked(hasLargestContentfulPaint).mockReturnValue(false)
      vi.mocked(hasEventTiming).mockReturnValue(false)
      vi.mocked(hasLayoutShift).mockReturnValue(false)

      const collector = new WebVitalsCollector()
      collector.start()

      const stats = collector.getStats()
      expect(stats.lcp).toBeNull()
      expect(stats.inp).toBeNull()
      expect(stats.cls).toBeNull()
    })
  })
})
