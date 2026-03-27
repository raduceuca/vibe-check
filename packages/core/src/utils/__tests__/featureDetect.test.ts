import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hasPerformanceObserver,
  hasEntryType,
  hasPerformanceMemory,
  hasLongAnimationFrame,
  hasLayoutShift,
  hasLargestContentfulPaint,
  hasEventTiming,
  hasMutationObserver,
  hasResourceTiming,
} from '../featureDetect'

describe('featureDetect', () => {
  const originalWindow = globalThis.window
  const originalPerformanceObserver = globalThis.PerformanceObserver
  const originalPerformance = globalThis.performance
  const originalMutationObserver = globalThis.MutationObserver

  afterEach(() => {
    // Restore original globals
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window
    } else {
      globalThis.window = originalWindow
    }

    if (originalPerformanceObserver === undefined) {
      delete (globalThis as Record<string, unknown>).PerformanceObserver
    } else {
      globalThis.PerformanceObserver = originalPerformanceObserver
    }

    if (originalPerformance === undefined) {
      delete (globalThis as Record<string, unknown>).performance
    } else {
      globalThis.performance = originalPerformance
    }

    if (originalMutationObserver === undefined) {
      delete (globalThis as Record<string, unknown>).MutationObserver
    } else {
      globalThis.MutationObserver = originalMutationObserver
    }

    vi.restoreAllMocks()
  })

  describe('hasPerformanceObserver', () => {
    it('returns false when window is undefined (SSR)', () => {
      const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
      delete (globalThis as Record<string, unknown>).window
      expect(hasPerformanceObserver()).toBe(false)
      if (windowDescriptor) {
        Object.defineProperty(globalThis, 'window', windowDescriptor)
      }
    })

    it('returns false when PerformanceObserver is undefined', () => {
      // Ensure window is defined
      globalThis.window = {} as Window & typeof globalThis
      delete (globalThis as Record<string, unknown>).PerformanceObserver
      expect(hasPerformanceObserver()).toBe(false)
    })

    it('returns true when PerformanceObserver exists', () => {
      globalThis.window = {} as Window & typeof globalThis
      globalThis.PerformanceObserver = class MockPO {
        constructor(_cb: PerformanceObserverCallback) {}
        observe() {}
        disconnect() {}
        takeRecords() { return [] }
        static supportedEntryTypes: string[] = []
      } as unknown as typeof PerformanceObserver
      expect(hasPerformanceObserver()).toBe(true)
    })
  })

  describe('hasEntryType', () => {
    it('returns false when PerformanceObserver is not available', () => {
      delete (globalThis as Record<string, unknown>).PerformanceObserver
      expect(hasEntryType('resource')).toBe(false)
    })

    it('returns true when entry type is in supportedEntryTypes', () => {
      globalThis.window = {} as Window & typeof globalThis
      const mockPO = {
        supportedEntryTypes: ['resource', 'long-animation-frame', 'layout-shift'],
      }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasEntryType('resource')).toBe(true)
      expect(hasEntryType('long-animation-frame')).toBe(true)
    })

    it('returns false when entry type is not in supportedEntryTypes', () => {
      globalThis.window = {} as Window & typeof globalThis
      const mockPO = {
        supportedEntryTypes: ['resource'],
      }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasEntryType('long-animation-frame')).toBe(false)
    })

    it('returns false when supportedEntryTypes throws', () => {
      globalThis.window = {} as Window & typeof globalThis
      const mockPO = {
        get supportedEntryTypes(): string[] {
          throw new Error('Not supported')
        },
      }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasEntryType('resource')).toBe(false)
    })
  })

  describe('hasPerformanceMemory', () => {
    it('returns false when window is undefined (SSR)', () => {
      const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
      delete (globalThis as Record<string, unknown>).window
      expect(hasPerformanceMemory()).toBe(false)
      if (windowDescriptor) {
        Object.defineProperty(globalThis, 'window', windowDescriptor)
      }
    })

    it('returns false when performance.memory is not available', () => {
      globalThis.window = {} as Window & typeof globalThis
      // performance object without memory property
      globalThis.performance = {} as Performance
      expect(hasPerformanceMemory()).toBe(false)
    })

    it('returns true when performance.memory exists', () => {
      globalThis.window = {} as Window & typeof globalThis
      globalThis.performance = {
        memory: {
          jsHeapSizeLimit: 100,
          totalJSHeapSize: 50,
          usedJSHeapSize: 25,
        },
      } as unknown as Performance
      expect(hasPerformanceMemory()).toBe(true)
    })
  })

  describe('convenience helpers', () => {
    beforeEach(() => {
      globalThis.window = {} as Window & typeof globalThis
    })

    it('hasLongAnimationFrame checks for long-animation-frame entry type', () => {
      const mockPO = { supportedEntryTypes: ['long-animation-frame'] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasLongAnimationFrame()).toBe(true)
    })

    it('hasLayoutShift checks for layout-shift entry type', () => {
      const mockPO = { supportedEntryTypes: ['layout-shift'] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasLayoutShift()).toBe(true)
    })

    it('hasLargestContentfulPaint checks for largest-contentful-paint entry type', () => {
      const mockPO = { supportedEntryTypes: ['largest-contentful-paint'] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasLargestContentfulPaint()).toBe(true)
    })

    it('hasEventTiming checks for event entry type', () => {
      const mockPO = { supportedEntryTypes: ['event'] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasEventTiming()).toBe(true)
    })

    it('hasResourceTiming checks for resource entry type', () => {
      const mockPO = { supportedEntryTypes: ['resource'] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasResourceTiming()).toBe(true)
    })

    it('convenience helpers return false when entry type is missing', () => {
      const mockPO = { supportedEntryTypes: [] as string[] }
      globalThis.PerformanceObserver = mockPO as unknown as typeof PerformanceObserver
      expect(hasLongAnimationFrame()).toBe(false)
      expect(hasLayoutShift()).toBe(false)
      expect(hasLargestContentfulPaint()).toBe(false)
      expect(hasEventTiming()).toBe(false)
      expect(hasResourceTiming()).toBe(false)
    })
  })

  describe('hasMutationObserver', () => {
    it('returns false when window is undefined (SSR)', () => {
      const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
      delete (globalThis as Record<string, unknown>).window
      expect(hasMutationObserver()).toBe(false)
      if (windowDescriptor) {
        Object.defineProperty(globalThis, 'window', windowDescriptor)
      }
    })

    it('returns false when MutationObserver is undefined', () => {
      globalThis.window = {} as Window & typeof globalThis
      delete (globalThis as Record<string, unknown>).MutationObserver
      expect(hasMutationObserver()).toBe(false)
    })

    it('returns true when MutationObserver exists', () => {
      globalThis.window = {} as Window & typeof globalThis
      globalThis.MutationObserver = class MockMO {
        constructor(_cb: MutationCallback) {}
        observe() {}
        disconnect() {}
        takeRecords() { return [] }
      } as unknown as typeof MutationObserver
      expect(hasMutationObserver()).toBe(true)
    })
  })
})
