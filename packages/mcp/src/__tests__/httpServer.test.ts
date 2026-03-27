import { describe, it, expect, afterEach } from 'vitest'
import type { Server } from 'node:http'
import { createHttpServer } from '../httpServer.js'
import type { VibeSnapshot } from '../types.js'

const makeSnapshot = (): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.67, maxFrameTime: 20, droppedFrames: 0, smoothness: 1 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 100, jsTransferKB: 50, cssTransferKB: 20, imageTransferKB: 20, fontTransferKB: 10, resourceCount: 5, largeResources: [] },
  issues: [],
  domNodeCount: 500,
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
