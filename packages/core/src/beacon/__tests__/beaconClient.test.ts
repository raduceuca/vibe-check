import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BeaconClient } from '../beaconClient.js'
import type { ProjectSnapshotEnvelope, VibeIssue, VibeSnapshot } from '../../types.js'
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

const createMockIssue = (): VibeIssue => ({
  id: 'dom-1',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 900 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 900 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
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
    const snapshotCallCount = () => mockFetch.mock.calls.filter(
      ([url]) => String(url).endsWith('/api/snapshot'),
    ).length

    expect(snapshotCallCount()).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(snapshotCallCount()).toBe(2)
    vi.advanceTimersByTime(2000)
    expect(snapshotCallCount()).toBe(3)

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

  it('wraps snapshots with stable project and browser instance identity', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    setFetch(mockFetch)
    const client = new BeaconClient({
      url: 'http://localhost:4200',
      intervalMs: 2000,
      projectId: 'my-project',
    })

    client.start(createMockSnapshot)
    const firstInit = mockFetch.mock.calls[0]![1] as RequestInit
    const first = JSON.parse(String(firstInit.body)) as ProjectSnapshotEnvelope
    client.sendNow()
    const secondInit = mockFetch.mock.calls[1]![1] as RequestInit
    const second = JSON.parse(String(secondInit.body)) as ProjectSnapshotEnvelope

    expect(first.projectId).toBe('my-project')
    expect(first.instanceId).toBeTruthy()
    expect(first.instanceId).toBe(second.instanceId)
    expect(first.pageUrl).toBe(window.location.href)
    expect(first.snapshot.domNodeCount).toBe(100)
    client.stop()
  })

  it('polls and exposes the real project agent status', async () => {
    vi.useRealTimers()
    const projectStatus = {
      projectId: 'project-a',
      state: 'watching' as const,
      queueDepth: 0,
      leaseExpiresAt: Date.now() + 15_000,
      conflictAt: null,
    }
    setFetch(vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return url.endsWith('/status')
        ? new Response(JSON.stringify(projectStatus), { status: 200 })
        : new Response(JSON.stringify({ received: true }), { status: 200 })
    }))
    const client = new BeaconClient({
      url: 'http://localhost:4200',
      intervalMs: 60_000,
      projectId: 'project-a',
    })

    client.start(createMockSnapshot)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(client.getStatus()).toMatchObject({
      projectId: 'project-a',
      lastOk: true,
      projectStatus,
      statusError: null,
    })
    client.stop()
  })

  it('dispatches an issue immediately and preserves structured failure codes', async () => {
    vi.useRealTimers()
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        code: 'dispatched',
        projectId: 'project-a',
        queueDepth: 0,
      }), { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'))
    setFetch(mockFetch)
    const client = new BeaconClient({
      url: 'http://localhost:4200',
      intervalMs: 2000,
      projectId: 'project-a',
    })

    await expect(client.dispatchIssue(createMockIssue())).resolves.toMatchObject({
      ok: true,
      code: 'dispatched',
    })
    const body = JSON.parse(String((mockFetch.mock.calls[0]![1] as RequestInit).body)) as {
      projectId: string
      pageUrl: string
      issue: VibeIssue
    }
    expect(body).toMatchObject({
      projectId: 'project-a',
      pageUrl: window.location.href,
      issue: { id: 'dom-1' },
    })

    await expect(client.dispatchIssue(createMockIssue())).resolves.toMatchObject({
      ok: false,
      code: 'hub-offline',
    })
  })

  it('aborts a stalled issue dispatch and reports a failed delivery', async () => {
    let requestSignal: AbortSignal | null = null
    setFetch(vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? null
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }))
    const client = new BeaconClient({
      url: 'http://localhost:4200',
      intervalMs: 2000,
      projectId: 'project-a',
    })

    const dispatch = client.dispatchIssue(createMockIssue())
    await vi.advanceTimersByTimeAsync(9_000)

    await expect(dispatch).resolves.toMatchObject({ ok: false, code: 'failed' })
    expect(requestSignal?.aborted).toBe(true)
  })
})
