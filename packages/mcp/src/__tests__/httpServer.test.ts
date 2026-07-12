import { describe, it, expect, afterEach } from 'vitest'
import type { Server } from 'node:http'
import { createHttpServer } from '../httpServer.js'
import type { VibeSnapshot, VibeIssue } from '../types.js'

const makeIssue = (overrides: Partial<VibeIssue> = {}): VibeIssue => ({
  id: 'issue-1',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 9000 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 9000 },
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
  ...overrides,
})

const makeSnapshot = (issues: readonly VibeIssue[] = []): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.67, maxFrameTime: 20, droppedFrames: 0, smoothness: 1 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 100, jsTransferKB: 50, cssTransferKB: 20, imageTransferKB: 20, fontTransferKB: 10, resourceCount: 5, largeResources: [] },
  issues,
  domNodeCount: 500,
})

const postSnapshot = (port: number, body: unknown): Promise<Response> =>
  fetch(`http://localhost:${port}/api/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

let activeServer: Server | null = null

const startServer = (onSnapshot: (s: VibeSnapshot) => void = () => {}): Promise<number> => {
  const ctx = createHttpServer(onSnapshot)
  activeServer = ctx.server

  return new Promise((resolve) => {
    ctx.server.listen(0, () => {
      const addr = ctx.server.address()
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0
      resolve(port)
    })
  })
}

afterEach(() => {
  if (activeServer) {
    activeServer.close()
    activeServer = null
  }
})

describe('httpServer', () => {
  it('GET /api/health returns { status: "ok" }', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/api/health`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ status: 'ok' })
  })

  it('POST /api/snapshot with valid body returns 200', async () => {
    const received: VibeSnapshot[] = []
    const port = await startServer((s) => received.push(s))

    const snapshot = makeSnapshot()
    const res = await fetch(`http://localhost:${port}/api/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
    expect(received).toHaveLength(1)
  })

  it('POST /api/snapshot with invalid body returns 400', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/api/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('accepts a snapshot containing a well-formed issue', async () => {
    const received: VibeSnapshot[] = []
    const port = await startServer((s) => received.push(s))

    const res = await postSnapshot(port, makeSnapshot([makeIssue()]))

    expect(res.status).toBe(200)
    expect(received).toHaveLength(1)
    expect(received[0]!.issues).toHaveLength(1)
  })

  it('rejects an issue with an unknown detector (would reach the agent verbatim)', async () => {
    const received: VibeSnapshot[] = []
    const port = await startServer((s) => received.push(s))

    const res = await postSnapshot(port, makeSnapshot([
      makeIssue({ detector: 'totally-made-up' as VibeIssue['detector'] }),
    ]))

    expect(res.status).toBe(400)
    expect(received).toHaveLength(0)
  })

  it('rejects an issue with an out-of-enum severity', async () => {
    const port = await startServer()
    const res = await postSnapshot(port, makeSnapshot([
      makeIssue({ severity: 'catastrophic' as VibeIssue['severity'] }),
    ]))
    expect(res.status).toBe(400)
  })

  it('rejects an issue whose required text fields are the wrong type', async () => {
    const port = await startServer()
    const res = await postSnapshot(port, makeSnapshot([
      makeIssue({ title: 12345 as unknown as string }),
    ]))
    expect(res.status).toBe(400)
  })

  it('rejects an over-long issue title (bounds stored/agent-facing strings)', async () => {
    const port = await startServer()
    const res = await postSnapshot(port, makeSnapshot([
      makeIssue({ title: 'x'.repeat(5000) }),
    ]))
    expect(res.status).toBe(400)
  })

  it('rejects a snapshot with too many issues', async () => {
    const port = await startServer()
    const many = Array.from({ length: 501 }, (_, i) => makeIssue({ id: `i-${i}` }))
    const res = await postSnapshot(port, makeSnapshot(many))
    expect(res.status).toBe(400)
  })

  it('POST /api/snapshot with non-JSON body returns 400', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/api/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty('error')
  })

  it('OPTIONS returns CORS headers', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/api/snapshot`, {
      method: 'OPTIONS',
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type')
  })

  it('GET /unknown returns 404', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/unknown`)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Not found' })
  })

  it('GET /api/health includes CORS headers', async () => {
    const port = await startServer()

    const res = await fetch(`http://localhost:${port}/api/health`)

    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})
