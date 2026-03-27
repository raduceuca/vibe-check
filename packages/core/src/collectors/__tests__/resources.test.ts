import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock feature detection to return true by default
vi.mock('../../utils/featureDetect.js', () => ({
  hasResourceTiming: vi.fn(() => true),
}))

import { ResourceCollector } from '../resources.js'
import { hasResourceTiming } from '../../utils/featureDetect.js'

type ObserverCallback = (list: { getEntries: () => unknown[] }) => void

let observerCallback: ObserverCallback | null = null
let disconnectSpy: ReturnType<typeof vi.fn>
let mockExistingEntries: unknown[] = []

const setupObserverMock = () => {
  observerCallback = null
  disconnectSpy = vi.fn()

  vi.stubGlobal(
    'PerformanceObserver',
    class MockPerformanceObserver {
      static supportedEntryTypes = ['resource']
      private readonly callback: ObserverCallback

      constructor(callback: ObserverCallback) {
        this.callback = callback
        observerCallback = callback
      }

      observe() {}

      disconnect() {
        disconnectSpy()
        observerCallback = null
      }
    },
  )
}

describe('ResourceCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockExistingEntries = []
    setupObserverMock()

    vi.mocked(hasResourceTiming).mockReturnValue(true)

    vi.spyOn(performance, 'getEntriesByType').mockImplementation((type: string) => {
      if (type === 'resource') {
        return mockExistingEntries as PerformanceEntryList
      }
      return []
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('returns empty stats before start', () => {
      const collector = new ResourceCollector()
      const stats = collector.getStats()

      expect(stats.totalTransferKB).toBe(0)
      expect(stats.resourceCount).toBe(0)
      expect(stats.largeResources).toEqual([])
    })
  })

  describe('resource aggregation', () => {
    it('aggregates JS resources (initiatorType: script)', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://cdn.example.com/app.js', transferSize: 51200, initiatorType: 'script' },
          { name: 'https://cdn.example.com/vendor.js', transferSize: 30720, initiatorType: 'script' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.jsTransferKB).toBeCloseTo(80) // (51200 + 30720) / 1024
      expect(stats.resourceCount).toBe(2)
    })

    it('aggregates CSS resources (initiatorType: link and css)', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://cdn.example.com/style.css', transferSize: 10240, initiatorType: 'link' },
          { name: 'https://cdn.example.com/theme.css', transferSize: 5120, initiatorType: 'css' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.cssTransferKB).toBeCloseTo(15) // (10240 + 5120) / 1024
    })

    it('aggregates image resources (initiatorType: img)', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://cdn.example.com/hero.png', transferSize: 204800, initiatorType: 'img' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.imageTransferKB).toBeCloseTo(200)
    })

    it('aggregates font resources (initiatorType: font)', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://cdn.example.com/Inter.woff2', transferSize: 20480, initiatorType: 'font' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.fontTransferKB).toBeCloseTo(20)
    })

    it('computes totalTransferKB across all types', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/app.js', transferSize: 10240, initiatorType: 'script' },
          { name: 'https://a.com/style.css', transferSize: 5120, initiatorType: 'link' },
          { name: 'https://a.com/logo.png', transferSize: 2048, initiatorType: 'img' },
          { name: 'https://a.com/font.woff2', transferSize: 3072, initiatorType: 'font' },
          { name: 'https://a.com/data.json', transferSize: 1024, initiatorType: 'fetch' },
        ],
      })

      const stats = collector.getStats()
      // (10240 + 5120 + 2048 + 3072 + 1024) / 1024 = 21
      expect(stats.totalTransferKB).toBeCloseTo(21)
      expect(stats.resourceCount).toBe(5)
    })

    it('classifies unknown initiatorTypes as other', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/api', transferSize: 1024, initiatorType: 'xmlhttprequest' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.jsTransferKB).toBe(0)
      expect(stats.cssTransferKB).toBe(0)
      expect(stats.imageTransferKB).toBe(0)
      expect(stats.fontTransferKB).toBe(0)
      // Still counted in total
      expect(stats.totalTransferKB).toBeCloseTo(1)
      expect(stats.resourceCount).toBe(1)
    })
  })

  describe('large resource detection', () => {
    it('flags resources with transferSize > 100KB', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/small.js', transferSize: 51200, initiatorType: 'script' },
          { name: 'https://a.com/large.js', transferSize: 204800, initiatorType: 'script' },
          { name: 'https://a.com/huge.png', transferSize: 512000, initiatorType: 'img' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.largeResources).toHaveLength(2)
      expect(stats.largeResources[0]).toEqual({
        url: 'https://a.com/large.js',
        transferSizeKB: 200,
        type: 'js',
      })
      expect(stats.largeResources[1]).toEqual({
        url: 'https://a.com/huge.png',
        transferSizeKB: 500,
        type: 'image',
      })
    })

    it('does not flag resources at exactly 100KB', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/borderline.js', transferSize: 102400, initiatorType: 'script' },
        ],
      })

      const stats = collector.getStats()
      // 102400 / 1024 = 100, which is NOT > 100
      expect(stats.largeResources).toHaveLength(0)
    })

    it('uses initiatorType for unknown types in large resources', () => {
      const collector = new ResourceCollector()
      collector.start()

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/big-api', transferSize: 204800, initiatorType: 'xmlhttprequest' },
        ],
      })

      const stats = collector.getStats()
      expect(stats.largeResources).toHaveLength(1)
      expect(stats.largeResources[0].type).toBe('xmlhttprequest')
    })
  })

  describe('deduplication', () => {
    it('does not double-count entries with the same URL', () => {
      const collector = new ResourceCollector()
      collector.start()

      const entry = { name: 'https://a.com/app.js', transferSize: 10240, initiatorType: 'script' }

      observerCallback?.({ getEntries: () => [entry] })
      observerCallback?.({ getEntries: () => [entry] })

      const stats = collector.getStats()
      expect(stats.resourceCount).toBe(1)
      expect(stats.jsTransferKB).toBeCloseTo(10)
    })
  })

  describe('initial scan', () => {
    it('picks up entries from performance.getEntriesByType on start', () => {
      mockExistingEntries = [
        { name: 'https://a.com/preloaded.js', transferSize: 20480, initiatorType: 'script' },
      ]

      const collector = new ResourceCollector()
      collector.start()

      const stats = collector.getStats()
      expect(stats.resourceCount).toBe(1)
      expect(stats.jsTransferKB).toBeCloseTo(20)
    })

    it('deduplicates between initial scan and observer entries', () => {
      const sharedEntry = {
        name: 'https://a.com/app.js',
        transferSize: 10240,
        initiatorType: 'script',
      }

      mockExistingEntries = [sharedEntry]

      const collector = new ResourceCollector()
      collector.start()

      // Observer fires with the same entry
      observerCallback?.({ getEntries: () => [sharedEntry] })

      const stats = collector.getStats()
      expect(stats.resourceCount).toBe(1)
    })
  })

  describe('polling', () => {
    it('picks up new entries on 5s poll interval', () => {
      const collector = new ResourceCollector()
      collector.start()

      // Initially empty (no pre-existing entries, observer hasn't fired)
      expect(collector.getStats().resourceCount).toBe(0)

      // Simulate a resource appearing after start but before next poll
      mockExistingEntries = [
        { name: 'https://a.com/late.js', transferSize: 5120, initiatorType: 'script' },
      ]

      // Advance timer by 5 seconds
      vi.advanceTimersByTime(5000)

      const stats = collector.getStats()
      expect(stats.resourceCount).toBe(1)
    })
  })

  describe('stop', () => {
    it('disconnects observer and clears poll timer', () => {
      const collector = new ResourceCollector()
      collector.start()

      collector.stop()

      expect(disconnectSpy).toHaveBeenCalledTimes(1)

      // Polling should no longer fire
      mockExistingEntries = [
        { name: 'https://a.com/after-stop.js', transferSize: 5120, initiatorType: 'script' },
      ]
      vi.advanceTimersByTime(10000)

      expect(collector.getStats().resourceCount).toBe(0)
    })
  })

  describe('onUpdate', () => {
    it('fires callback when new resources are observed', () => {
      const collector = new ResourceCollector()
      const callback = vi.fn()

      collector.start()
      const unsubscribe = collector.onUpdate(callback)

      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/app.js', transferSize: 10240, initiatorType: 'script' },
        ],
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceCount: 1,
        }),
      )

      unsubscribe()
      observerCallback?.({
        getEntries: () => [
          { name: 'https://a.com/vendor.js', transferSize: 5120, initiatorType: 'script' },
        ],
      })

      // Should not fire after unsubscribe
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('graceful degradation', () => {
    it('returns empty stats when resource timing is unavailable', () => {
      vi.mocked(hasResourceTiming).mockReturnValue(false)

      const collector = new ResourceCollector()
      collector.start()

      const stats = collector.getStats()
      expect(stats.totalTransferKB).toBe(0)
      expect(stats.resourceCount).toBe(0)
      expect(stats.largeResources).toEqual([])
    })

    it('does not create observer when resource timing is unavailable', () => {
      vi.mocked(hasResourceTiming).mockReturnValue(false)

      const collector = new ResourceCollector()
      collector.start()

      expect(observerCallback).toBeNull()
    })
  })
})
