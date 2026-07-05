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

// Delivery goes through fetch so the outcome is observable (res.ok drives the
// connection indicator). sendBeacon is only a legacy fallback and — because a
// queued beacon is not a confirmed delivery — must never report success.
describe('BeaconClient', () => {
  let originalSendBeacon: typeof navigator.sendBeacon
  let originalFetch: typeof globalThis.fetch

  const setFetch = (fn: unknown): void => {
    globalThis.fetch = fn as typeof globalThis.fetch
  }
  const setSendBeacon = (value: unknown): void => {
    Object.defineProperty(navigator, 'sendBeacon', { value, writable: true, configurable: true })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    originalSendBeacon = navigator.sendBeacon
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    setSendBeacon(originalSendBeacon)
    globalThis.fetch = originalFetch
  })

  it('sends snapshot immediately on start via fetch', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    setFetch(mockFetch)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const getSnapshot = vi.fn(createMockSnapshot)
    client.start(getSnapshot)

    expect(getSnapshot).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/snapshot',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    )

    client.stop()
  })

  it('sends snapshot at the configured interval', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    setFetch(mockFetch)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    client.start(vi.fn(createMockSnapshot))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(2000)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    client.stop()
  })

  it('stops sending after stop()', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    setFetch(mockFetch)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 1000 })
    client.start(vi.fn(createMockSnapshot))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    client.stop()
    vi.advanceTimersByTime(5000)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sendNow() triggers an immediate send', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    setFetch(mockFetch)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 10000 })
    client.start(vi.fn(createMockSnapshot))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    client.sendNow()
    expect(mockFetch).toHaveBeenCalledTimes(2)

    client.stop()
  })

  it('never throws when neither fetch nor sendBeacon is available', () => {
    setFetch(undefined)
    setSendBeacon(undefined)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    expect(() => client.start(vi.fn(createMockSnapshot))).not.toThrow()
    expect(client.getStatus().lastOk).toBe(false)

    client.stop()
  })

  // ── Delivery status (honest connection indicator) ────────────────────────
  it('reports an unattempted status before the first send', () => {
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    const status = client.getStatus()
    expect(status.configured).toBe(true)
    expect(status.lastAttemptAt).toBeNull()
    expect(status.lastOk).toBeNull()
  })

  it('records lastOk=true when fetch delivery resolves ok', async () => {
    vi.useRealTimers()
    setSendBeacon(undefined)
    setFetch(vi.fn().mockResolvedValue(new Response(null, { status: 200 })))

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 60_000 })
    client.start(vi.fn(createMockSnapshot))
    await new Promise((r) => setTimeout(r, 0))

    expect(client.getStatus().lastOk).toBe(true)
    expect(typeof client.getStatus().lastAttemptAt).toBe('number')
    client.stop()
  })

  it('records lastOk=false when fetch delivery fails (e.g. no server listening)', async () => {
    vi.useRealTimers()
    setSendBeacon(undefined)
    setFetch(vi.fn().mockRejectedValue(new Error('connection refused')))

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 60_000 })
    client.start(vi.fn(createMockSnapshot))
    await new Promise((r) => setTimeout(r, 0))

    expect(client.getStatus().lastOk).toBe(false)
    client.stop()
  })

  it('records lastOk=false when the server responds non-ok', async () => {
    vi.useRealTimers()
    setSendBeacon(undefined)
    setFetch(vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 60_000 })
    client.start(vi.fn(createMockSnapshot))
    await new Promise((r) => setTimeout(r, 0))

    expect(client.getStatus().lastOk).toBe(false)
    client.stop()
  })

  it('legacy sendBeacon fallback delivers but leaves status unknown (never a false "connected")', () => {
    setFetch(undefined)
    const mockSendBeacon = vi.fn().mockReturnValue(true)
    setSendBeacon(mockSendBeacon)

    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })
    client.start(vi.fn(createMockSnapshot))

    expect(mockSendBeacon).toHaveBeenCalledTimes(1)
    expect(mockSendBeacon).toHaveBeenCalledWith('http://localhost:4200/api/snapshot', expect.any(Blob))
    // A queued beacon is not a confirmed delivery, so lastOk stays null (unknown).
    expect(client.getStatus().lastOk).toBeNull()
    expect(typeof client.getStatus().lastAttemptAt).toBe('number')

    client.stop()
  })
})
