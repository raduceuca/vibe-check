import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BeaconClient } from '../beaconClient.js'
import type { VibeSnapshot } from '../../types.js'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
} from '../../types.js'

const createMockSnapshot = (): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: EMPTY_FRAME_RATE_STATS,
  longFrames: EMPTY_LONG_FRAME_STATS,
  webVitals: EMPTY_WEB_VITALS,
  memory: null,
  resources: EMPTY_RESOURCE_STATS,
  issues: [],
  domNodeCount: 100,
})

describe('BeaconClient', () => {
  let originalSendBeacon: typeof navigator.sendBeacon
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    originalSendBeacon = navigator.sendBeacon
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      writable: true,
      configurable: true,
    })
    globalThis.fetch = originalFetch
  })

  it('sends snapshot immediately on start via sendBeacon', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    })

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    client.start(getSnapshot)

    expect(getSnapshot).toHaveBeenCalledTimes(1)
    expect(mockSendBeacon).toHaveBeenCalledTimes(1)
    expect(mockSendBeacon).toHaveBeenCalledWith(
      'http://localhost:4200/api/snapshot',
      expect.any(Blob)
    )

    client.stop()
  })

  it('sends snapshot at configured interval', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    })

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    client.start(getSnapshot)

    // Initial send
    expect(mockSendBeacon).toHaveBeenCalledTimes(1)

    // Advance 2 seconds
    vi.advanceTimersByTime(2000)
    expect(mockSendBeacon).toHaveBeenCalledTimes(2)

    // Advance another 2 seconds
    vi.advanceTimersByTime(2000)
    expect(mockSendBeacon).toHaveBeenCalledTimes(3)

    client.stop()
  })

  it('stops sending after stop()', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    })

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 1000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    client.start(getSnapshot)
    expect(mockSendBeacon).toHaveBeenCalledTimes(1)

    client.stop()

    vi.advanceTimersByTime(5000)
    expect(mockSendBeacon).toHaveBeenCalledTimes(1) // No more calls after stop
  })

  it('falls back to fetch when sendBeacon unavailable', () => {
    // Remove sendBeacon
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const mockFetch = vi.fn().mockResolvedValue(new Response())
    globalThis.fetch = mockFetch

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    client.start(getSnapshot)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/snapshot',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      })
    )

    client.stop()
  })

  it('sendNow() triggers immediate send', () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: mockSendBeacon,
      writable: true,
      configurable: true,
    })

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 10000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    client.start(getSnapshot)
    expect(mockSendBeacon).toHaveBeenCalledTimes(1) // Initial

    client.sendNow()
    expect(mockSendBeacon).toHaveBeenCalledTimes(2) // Manual

    client.stop()
  })

  it('silently handles fetch errors', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    globalThis.fetch = mockFetch

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const getSnapshot = vi.fn(createMockSnapshot)

    // Should not throw
    expect(() => client.start(getSnapshot)).not.toThrow()

    client.stop()
  })
})
