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
    // Routine sends never ask for keepalive: browsers reject a keepalive body
    // over 64 KiB, which used to kill the beacon on busy pages (C2).
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/snapshot',
      expect.objectContaining({ method: 'POST', keepalive: false }),
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

// ── 0.4: bounded bodies, failure kinds, backoff, quiet background tabs ──────

type FetchCall = readonly [RequestInfo | URL, RequestInit | undefined]

const snapshotCalls = (mock: ReturnType<typeof vi.fn>): FetchCall[] =>
  (mock.mock.calls as FetchCall[]).filter(([url]) => String(url).endsWith('/api/snapshot'))

const statusCalls = (mock: ReturnType<typeof vi.fn>): FetchCall[] =>
  (mock.mock.calls as FetchCall[]).filter(([url]) => String(url).endsWith('/status'))

const okStatusBody = (): string => JSON.stringify({
  projectId: 'project-a',
  state: 'watching',
  queueDepth: 0,
  leaseExpiresAt: null,
  conflictAt: null,
})

const heavyIssue = (index: number): VibeIssue => ({
  id: `shift-${index}`,
  detector: index % 2 === 0 ? 'layout-thrashing' : 'console-spam',
  severity: 'warning',
  title: `Layout shift cluster ${index} `.repeat(4),
  description: 'Content moved after it rendered. '.repeat(20),
  evidence: { shiftCount: 3, totalShift: 0.2, sources: ['div.accordion', 'p'], note: 'x'.repeat(900) },
  timestamp: 1_000 + index,
  acknowledged: false,
  resolved: false,
})

describe('BeaconClient (0.4 delivery rules)', () => {
  let originalFetch: typeof globalThis.fetch
  let hidden = false

  const setHidden = (value: boolean): void => {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    originalFetch = globalThis.fetch
    hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
    delete (document as { hidden?: boolean }).hidden
  })

  it('keeps every body under the snapshot budget and lists what it dropped', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    globalThis.fetch = mockFetch as typeof fetch
    const issues = Array.from({ length: 400 }, (_, index) => heavyIssue(index))
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(() => ({ ...createMockSnapshot(), issues }))
    const body = String(snapshotCalls(mockFetch)[0]![1]!.body)
    const envelope = JSON.parse(body) as ProjectSnapshotEnvelope

    expect(new TextEncoder().encode(body).length).toBeLessThanOrEqual(48_000)
    expect(envelope.snapshot.issues.length).toBeLessThan(400)
    expect(envelope.snapshot.truncation?.droppedIssues).toBe(400 - envelope.snapshot.issues.length)
    expect(envelope.snapshot.truncation?.detectors).toEqual(
      expect.arrayContaining(['layout-thrashing', 'console-spam']),
    )
    client.stop()
  })

  it('asks for keepalive only on the final pagehide send', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    vi.advanceTimersByTime(2000)
    window.dispatchEvent(new Event('pagehide'))

    const keepalive = snapshotCalls(mockFetch).map(([, init]) => init?.keepalive)
    expect(keepalive).toEqual([false, false, true])
    client.stop()
  })

  it.each([
    [413, null, 'payload-too-large'],
    [400, { error: 'bad', code: 'bad-request' }, 'rejected'],
    [500, { error: 'boom', code: 'internal-error' }, 'rejected'],
    [403, { error: 'no', code: 'origin-not-allowed', hint: 'Start the hub with --allow-origin' }, 'origin-not-allowed'],
  ] as const)('reports HTTP %i as %s, never as an offline hub', async (status, body, expected) => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/status')
      ? new Response(okStatusBody(), { status: 200 })
      : new Response(body === null ? null : JSON.stringify(body), { status })) as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(0)

    expect(client.getStatus()).toMatchObject({ lastOk: false, lastError: expected })
    expect(client.getStatus().statusError).toBeNull()
    client.stop()
  })

  it('tells a refused origin (hub reachable, CORS blocked) apart from a dead hub', async () => {
    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      // The CORS request fails like a network error; a no-cors probe still reaches the hub.
      if (init?.mode === 'no-cors') return new Response(null, { status: 200 })
      throw new TypeError('Failed to fetch')
    })
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(0)

    expect(client.getStatus()).toMatchObject({ lastOk: false, lastError: 'origin-not-allowed', statusError: null })
    const probe = (mockFetch.mock.calls as FetchCall[]).find(([, init]) => init?.mode === 'no-cors')
    expect(String(probe?.[0])).toBe('http://localhost:4200/api/health')
    client.stop()
  })

  it('reports a dead hub as hub-offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(0)

    expect(client.getStatus()).toMatchObject({ lastOk: false, lastError: 'hub-offline', statusError: 'hub-offline' })
    client.stop()
  })

  it('backs off 2 → 4 → 8 → 16 → 30 → 60 s while the hub is down, without status polling (C17)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    globalThis.fetch = mockFetch as typeof fetch
    const startedAt = Date.now()
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    const attemptTimes: number[] = []
    let seen = 0
    for (let elapsed = 0; elapsed <= 180_000; elapsed += 500) {
      await vi.advanceTimersByTimeAsync(elapsed === 0 ? 0 : 500)
      const count = snapshotCalls(mockFetch).length
      if (count > seen) {
        attemptTimes.push(Date.now() - startedAt)
        seen = count
      }
    }

    expect(attemptTimes).toEqual([0, 2_000, 6_000, 14_000, 30_000, 60_000, 120_000, 180_000])
    expect(statusCalls(mockFetch)).toHaveLength(0)
    expect(client.getStatus().retryAt).toBe(startedAt + 240_000)
    client.stop()
  })

  it('returns to the normal cadence after the hub comes back', async () => {
    let up = false
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      if (!up) throw new TypeError('Failed to fetch')
      return String(input).endsWith('/status')
        ? new Response(okStatusBody(), { status: 200 })
        : new Response(null, { status: 200 })
    })
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(6_000) // attempts at 0, 2 s, 6 s; next at 14 s
    expect(client.getStatus().retryAt).not.toBeNull()

    up = true
    await vi.advanceTimersByTimeAsync(8_000) // the 14 s attempt succeeds
    expect(client.getStatus()).toMatchObject({ lastOk: true, lastError: null, retryAt: null })
    expect(client.getStatus().projectStatus).toMatchObject({ state: 'watching' })

    const before = snapshotCalls(mockFetch).length
    await vi.advanceTimersByTimeAsync(2_000)
    expect(snapshotCalls(mockFetch).length).toBe(before + 1)
    client.stop()
  })

  it('does not refresh status after every successful POST (C6)', async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/status')
      ? new Response(okStatusBody(), { status: 200 })
      : new Response(null, { status: 200 }))
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(20_000)

    // 11 POSTs (0..20 s) and 11 status GETs (one after the first success, then
    // the 2 s poll). Before 0.4 every POST added another GET: 21.
    expect(snapshotCalls(mockFetch)).toHaveLength(11)
    expect(statusCalls(mockFetch)).toHaveLength(11)
    client.stop()
  })

  it('sends nothing while the tab is hidden and resumes at once when it is visible again (C6)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(0)
    setHidden(true)
    const beforeHidden = snapshotCalls(mockFetch).length
    const statusBeforeHidden = statusCalls(mockFetch).length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(snapshotCalls(mockFetch)).toHaveLength(beforeHidden)
    expect(statusCalls(mockFetch)).toHaveLength(statusBeforeHidden)

    setHidden(false)
    expect(snapshotCalls(mockFetch)).toHaveLength(beforeHidden + 1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(snapshotCalls(mockFetch)).toHaveLength(beforeHidden + 2)
    client.stop()
  })

  it('retries immediately with a fresh backoff when the tab becomes visible', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    await vi.advanceTimersByTimeAsync(14_000) // attempts at 0, 2, 6, 14 s; next at 30 s
    const before = snapshotCalls(mockFetch).length
    setHidden(true)
    setHidden(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(snapshotCalls(mockFetch)).toHaveLength(before + 1)
    // Backoff restarted: the next attempt is 2 s away, not 30 s.
    await vi.advanceTimersByTimeAsync(2_000)
    expect(snapshotCalls(mockFetch)).toHaveLength(before + 2)
    client.stop()
  })

  it('reports a refused legacy beacon as rejected', () => {
    globalThis.fetch = undefined as unknown as typeof fetch
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn().mockReturnValue(false), writable: true, configurable: true })
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)

    expect(client.getStatus()).toMatchObject({ lastOk: false, lastError: 'rejected' })
    client.stop()
  })

  it('maps a hub error body on dispatch to a dispatch failure code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Origin not allowed',
      code: 'origin-not-allowed',
      hint: 'Start the hub with --allow-origin <origin> or set VIBE_CHECK_ALLOWED_ORIGINS.',
    }), { status: 403 })) as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000, projectId: 'project-a' })

    await expect(client.dispatchIssue(createMockIssue())).resolves.toEqual({
      ok: false,
      code: 'origin-not-allowed',
      projectId: 'project-a',
      queueDepth: 0,
    })
  })

  it('does not start twice', () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    globalThis.fetch = mockFetch as typeof fetch
    const client = new BeaconClient({ url: 'http://localhost:4200', intervalMs: 2000 })

    client.start(createMockSnapshot)
    client.start(createMockSnapshot)
    vi.advanceTimersByTime(2000)

    expect(snapshotCalls(mockFetch)).toHaveLength(2)
    client.stop()
  })
})
