import { afterEach, describe, expect, it } from 'vitest'
import { request as httpRequest } from 'node:http'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHubServer, type HubServerContext } from '../hubServer.js'
import { registerProjectRoot } from '../projectRegistry.js'
import type {
  DetectorRunStatus,
  ProjectSnapshotEnvelope,
  VibeIssue,
  VibeSnapshot,
} from '../types.js'

const makeIssue = (id = 'dom-1'): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 900 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 900 },
  timestamp: 1,
  lastSeenAt: 1,
  occurrences: 1,
  acknowledged: false,
  resolved: false,
})

const detectorStatus = (evaluatedAt: number): DetectorRunStatus => ({
  detector: 'dom-bloat',
  kind: 'continuous',
  observingSince: evaluatedAt - 1,
  settledAt: evaluatedAt - 1,
  evaluatedAt,
})

const makeSnapshot = (
  issues: readonly VibeIssue[] = [],
  timestamp = 1,
  withDetectors = true,
): VibeSnapshot => ({
  timestamp,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: {
    totalTransferKB: 0,
    jsTransferKB: 0,
    cssTransferKB: 0,
    imageTransferKB: 0,
    fontTransferKB: 0,
    resourceCount: 0,
    largeResources: [],
  },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues,
  domNodeCount: 900,
  ...(withDetectors
    ? { engineStartedAt: timestamp - 10, detectors: [detectorStatus(timestamp)] }
    : {}),
})

const envelope = (
  projectId: string,
  instanceId: string,
  issues = [makeIssue()],
  path = '/fixture',
  timestamp = 1,
  withDetectors = true,
): ProjectSnapshotEnvelope => ({
  projectId,
  instanceId,
  origin: projectId,
  pageUrl: `http://${projectId}${path}`,
  title: `Fixture ${projectId}`,
  snapshot: makeSnapshot(issues, timestamp, withDetectors),
})

let context: HubServerContext | null = null

const start = async (
  now: () => number = Date.now,
  options: { allowedOrigins?: readonly string[] } = {},
) => {
  context = createHubServer({ version: '0.4.0', now, ...options })
  await new Promise<void>((resolve) => context!.server.listen(0, '127.0.0.1', resolve))
  const address = context.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return `http://127.0.0.1:${port}`
}

const json = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init)
  const text = await response.text()
  return {
    response,
    body: text.length === 0 ? null : JSON.parse(text) as unknown,
  }
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) => json(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

afterEach(async () => {
  await context?.close()
  context = null
})

describe('hubServer', () => {
  it('identifies itself and keeps project snapshots isolated', async () => {
    const base = await start()
    expect((await json(`${base}/api/health`)).body).toEqual({
      status: 'ok',
      service: 'vibe-check-hub',
      version: '0.4.0',
    })

    await post(`${base}/api/snapshot`, envelope('project-a', 'a'))
    await post(`${base}/api/snapshot`, envelope('project-b', 'b', [makeIssue('b-1')]))

    const projects = await json(`${base}/internal/projects`)
    expect(projects.response.status).toBe(200)
    expect(projects.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ projectId: 'project-a' }),
      expect.objectContaining({ projectId: 'project-b' }),
    ]))
    const snapshot = await json(`${base}/internal/projects/${encodeURIComponent('project-b')}/snapshot`)
    expect(snapshot.body).toMatchObject({ issues: [{ id: 'b-1' }] })
  })

  it('rejects browser access to bridge-only routes', async () => {
    const base = await start()
    const result = await json(`${base}/internal/projects`, {
      headers: { origin: 'http://localhost:5173' },
    })
    expect(result.response.status).toBe(403)
    expect(result.body).toMatchObject({ code: 'origin-not-allowed' })
  })

  it('rejects a cross-origin browser request and never echoes ACAO * (MCP-01)', async () => {
    const base = await start()
    await post(`${base}/api/snapshot`, envelope('project-a', 'a'))

    const blocked = await post(
      `${base}/api/snapshot`,
      envelope('project-a', 'evil'),
      { Origin: 'https://evil.example' },
    )
    expect(blocked.response.status).toBe(403)
    expect(blocked.body).toMatchObject({ code: 'origin-not-allowed' })
    expect(blocked.response.headers.get('access-control-allow-origin')).toBeNull()

    const allowed = await post(
      `${base}/api/snapshot`,
      envelope('project-a', 'local'),
      { Origin: 'http://localhost:5173' },
    )
    expect(allowed.response.status).toBe(200)
    expect(allowed.response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(allowed.response.headers.get('access-control-allow-origin')).not.toBe('*')

    const textPlain = await json(`${base}/api/snapshot`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify(envelope('project-a', 'plain')),
    })
    expect(textPlain.response.status).toBe(415)
    expect(textPlain.body).toMatchObject({ code: 'unsupported-media-type' })
  })

  it('rejects a rebinding Host header (MCP-01)', async () => {
    await start()
    const address = context!.server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    // undici's fetch rewrites Host to the URL host; speak HTTP directly so the
    // rebinding header reaches the hub the way a DNS-rebinding browser would.
    const blocked = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const req = httpRequest({
        host: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        headers: { Host: `rebind.evil.example:${port}` },
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          })
        })
      })
      req.on('error', reject)
      req.end()
    })
    expect(blocked.status).toBe(403)
    expect(blocked.body).toMatchObject({ code: 'host-not-allowed' })
  })

  it('returns 400 for a malformed path and keeps serving (MCP-02)', async () => {
    const base = await start()
    const bad = await json(`${base}/%`)
    expect(bad.response.status).toBe(400)
    expect(bad.body).toMatchObject({ code: 'bad-request' })
    expect((await json(`${base}/api/health`)).response.status).toBe(200)
  })

  it('preserves the owner and reports a second-agent conflict to the widget', async () => {
    const base = await start()
    await post(`${base}/api/snapshot`, envelope('project-a', 'a'))
    const project = encodeURIComponent('project-a')

    const owner = await post(`${base}/internal/projects/${project}/leases/acquire`, {
      sessionId: 'agent-a',
      clientName: 'codex',
    })
    expect(owner.response.status).toBe(200)
    const conflict = await post(`${base}/internal/projects/${project}/leases/acquire`, {
      sessionId: 'agent-b',
    })
    expect(conflict.response.status).toBe(409)
    expect(conflict.body).toMatchObject({ ok: false, code: 'lease-conflict' })
    expect((conflict.body as { message?: string }).message).toMatch(/codex|another agent/i)

    const status = await json(`${base}/api/projects/${project}/status`)
    // Claimed but not waiting on watch_for_issue → leased (E2E-04 / MCP-05).
    expect(status.body).toMatchObject({ state: 'leased' })
    expect((status.body as { conflictAt: number | null }).conflictAt).not.toBeNull()
  })

  it('completes an agent long-poll when the widget dispatches an issue', async () => {
    const base = await start()
    const issue = makeIssue('send-me')
    await post(`${base}/api/snapshot`, envelope('project-a', 'a', [issue]))
    const project = encodeURIComponent('project-a')
    await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })

    const waiting = post(`${base}/internal/projects/${project}/issues/next`, {
      sessionId: 'agent-a',
      timeoutSeconds: 5,
    })
    // Give the long-poll a tick to register as waiting.
    await new Promise((resolve) => setTimeout(resolve, 20))
    const dispatched = await post(`${base}/api/projects/${project}/dispatch`, {
      projectId: 'project-a',
      instanceId: 'a',
      pageUrl: 'http://project-a/fixture',
      issue,
    })
    expect(dispatched.response.status).toBe(200)
    expect(dispatched.body).toMatchObject({ ok: true, code: 'dispatched' })

    const received = await waiting
    expect(received.response.status).toBe(200)
    expect(received.body).toMatchObject({
      projectId: 'project-a',
      issue: { id: 'send-me' },
      deliveryId: expect.any(String),
    })
    const deliveryId = (received.body as { deliveryId: string }).deliveryId
    const ack = await post(`${base}/internal/projects/${project}/deliveries/${encodeURIComponent(deliveryId)}/ack`, {
      sessionId: 'agent-a',
      deliveryId,
    })
    expect(ack.response.status).toBe(200)
    expect(ack.body).toMatchObject({ ok: true, code: 'delivered' })

    const status = await json(`${base}/api/projects/${project}/status`)
    expect(status.body).toMatchObject({ state: 'busy', queueDepth: 0 })
  })

  it('keeps a queued dispatch when nobody is waiting (MCP-04/05)', async () => {
    const base = await start()
    const issue = makeIssue('queued-me')
    await post(`${base}/api/snapshot`, envelope('project-a', 'a', [issue]))
    const project = encodeURIComponent('project-a')
    await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })

    const dispatched = await post(`${base}/api/projects/${project}/dispatch`, {
      projectId: 'project-a',
      instanceId: 'a',
      pageUrl: 'http://project-a/fixture',
      issue,
    })
    expect(dispatched.response.status).toBe(200)
    expect(dispatched.body).toMatchObject({ ok: true, code: 'queued', deliveryId: expect.any(String) })

    const status = await json(`${base}/api/projects/${project}/status`)
    expect(status.body).toMatchObject({ state: 'leased', queueDepth: 1 })

    const next = await post(`${base}/internal/projects/${project}/issues/next`, {
      sessionId: 'agent-a',
      timeoutSeconds: 1,
    })
    expect(next.response.status).toBe(200)
    expect(next.body).toMatchObject({ issue: { id: 'queued-me' } })
  })

  it('filters active issues and applies acknowledge/resolve per project', async () => {
    const base = await start()
    await post(`${base}/api/snapshot`, envelope('project-a', 'a', [makeIssue('a-1')]))
    const project = encodeURIComponent('project-a')
    await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })
    const issues = await json(`${base}/internal/projects/${project}/issues?severity=warning`)
    expect(issues.body).toMatchObject([{ id: 'a-1' }])

    await post(`${base}/internal/projects/${project}/issues/a-1/acknowledge`, { sessionId: 'agent-a' })
    expect((await json(`${base}/internal/projects/${project}/issues`)).body).toEqual([])
    await post(`${base}/internal/projects/${project}/issues/a-1/resolve`, { sessionId: 'agent-a' })
    expect((await json(`${base}/internal/projects/${project}/issues/a-1`)).body).toMatchObject({ id: 'a-1' })
  })

  it('tracks a real issue through verified fix and regression', async () => {
    let clock = 1
    const base = await start(() => clock)
    const project = encodeURIComponent('project-a')
    await post(
      `${base}/api/snapshot`,
      envelope('project-a', 'browser-a', [makeIssue('first')], '/pricing', clock),
    )
    clock = 2
    await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })
    await post(`${base}/api/projects/${project}/dispatch`, {
      projectId: 'project-a',
      instanceId: 'browser-a',
      pageUrl: 'http://project-a/pricing',
      issue: makeIssue('first'),
    })
    const delivered = await post(`${base}/internal/projects/${project}/issues/next`, {
      sessionId: 'agent-a',
      timeoutSeconds: 1,
    })
    const deliveryId = (delivered.body as { deliveryId: string }).deliveryId
    await post(`${base}/internal/projects/${project}/deliveries/${encodeURIComponent(deliveryId)}/ack`, {
      sessionId: 'agent-a',
      deliveryId,
    })

    const working = await json(`${base}/api/projects/${project}/workflow`, {
      headers: { Origin: 'http://127.0.0.1:5173' },
    })
    expect(working.response.status).toBe(200)
    expect(working.response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
    expect(working.response.headers.get('access-control-allow-origin')).not.toBe('*')
    expect(working.body).toMatchObject({ issues: [{ phase: 'working' }] })

    clock = 4
    const verification = await post(`${base}/api/projects/${project}/issues/first/verify`, {})
    expect(verification.response.status).toBe(200)
    expect(verification.body).toMatchObject({ ok: true, code: 'verifying' })
    expect((await json(`${base}/api/projects/${project}/workflow`)).body)
      .toMatchObject({ issues: [{ phase: 'verifying' }] })
    clock = 5
    await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [], '/pricing', clock))
    clock = 6
    await post(`${base}/api/snapshot`, envelope('project-a', 'browser-a', [], '/pricing', clock))
    expect((await json(`${base}/api/projects/${project}/workflow`)).body)
      .toMatchObject({ issues: [{ phase: 'fixed' }] })

    clock = 7
    await post(
      `${base}/api/snapshot`,
      envelope('project-a', 'browser-a', [{ ...makeIssue('returned'), timestamp: 7, lastSeenAt: 7 }], '/pricing', clock),
    )
    expect((await json(`${base}/api/projects/${project}/workflow`)).body).toMatchObject({
      issues: [{ phase: 'regressed', occurrenceCount: 2, regressionCount: 1 }],
    })
  })

  it('returns isolated impact and resets only the selected project', async () => {
    let clock = 1
    const base = await start(() => clock)
    for (const projectId of ['project-a', 'project-b']) {
      const project = encodeURIComponent(projectId)
      await post(`${base}/api/snapshot`, envelope(projectId, 'browser', [makeIssue()], '/impact', clock))
      clock += 1
      await post(`${base}/api/projects/${project}/issues/dom-1/verify`, {})
      clock += 1
      await post(`${base}/api/snapshot`, envelope(projectId, 'browser', [], '/impact', clock))
      clock += 1
      await post(`${base}/api/snapshot`, envelope(projectId, 'browser', [], '/impact', clock))
      clock += 1
    }

    const projectA = encodeURIComponent('project-a')
    const projectB = encodeURIComponent('project-b')
    // Widget "check this fix" without a prior send does not count as a verified fix (MCP-06).
    expect((await json(`${base}/api/projects/${projectA}/impact`)).body)
      .toMatchObject({ projectId: 'project-a', verifiedFixes: 0 })
    expect((await json(`${base}/api/projects/${projectB}/impact`)).body)
      .toMatchObject({ projectId: 'project-b', verifiedFixes: 0 })

    const reset = await post(`${base}/api/projects/${projectA}/impact/reset`, {})
    expect(reset.response.status).toBe(200)
    expect((await json(`${base}/api/projects/${projectA}/impact`)).body)
      .toMatchObject({ verifiedFixes: 0 })
    expect((await json(`${base}/api/projects/${projectB}/impact`)).body)
      .toMatchObject({ verifiedFixes: 0 })
  })

  it('restores a fixed workflow from the registered project after hub restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vibe-check-hub-state-'))
    const projectRoot = join(root, 'project')
    const registryPath = join(root, 'registry.json')
    await mkdir(projectRoot)
    await registerProjectRoot(registryPath, 'project-a', projectRoot)
    let clock = 1

    try {
      context = createHubServer({ version: '0.4.0', registryPath, now: () => clock })
      await new Promise<void>((resolve) => context!.server.listen(0, '127.0.0.1', resolve))
      let address = context.server.address()
      let port = typeof address === 'object' && address ? address.port : 0
      let base = `http://127.0.0.1:${port}`
      const project = encodeURIComponent('project-a')
      const issue = makeIssue('first')
      await post(base + '/api/snapshot', envelope(
        'project-a', 'browser-a', [issue], '/pricing', clock,
      ))
      clock = 2
      await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })
      await post(`${base}/api/projects/${project}/dispatch`, {
        projectId: 'project-a',
        instanceId: 'browser-a',
        pageUrl: 'http://project-a/pricing',
        issue,
      })
      const delivered = await post(`${base}/internal/projects/${project}/issues/next`, {
        sessionId: 'agent-a',
        timeoutSeconds: 1,
      })
      const deliveryId = (delivered.body as { deliveryId: string }).deliveryId
      await post(`${base}/internal/projects/${project}/deliveries/${encodeURIComponent(deliveryId)}/ack`, {
        sessionId: 'agent-a',
        deliveryId,
      })
      clock = 3
      await post(`${base}/api/projects/${project}/issues/first/verify`, {})
      clock = 4
      await post(base + '/api/snapshot', envelope('project-a', 'browser-a', [], '/pricing', clock))
      clock = 5
      await post(base + '/api/snapshot', envelope('project-a', 'browser-a', [], '/pricing', clock))
      expect((await json(`${base}/api/projects/${project}/workflow`)).body)
        .toMatchObject({ issues: [{ phase: 'fixed' }] })
      await context.close()
      context = null

      context = createHubServer({ version: '0.4.0', registryPath, now: () => clock })
      await new Promise<void>((resolve) => context!.server.listen(0, '127.0.0.1', resolve))
      address = context.server.address()
      port = typeof address === 'object' && address ? address.port : 0
      base = `http://127.0.0.1:${port}`
      expect((await json(`${base}/api/projects/${project}/impact`)).body)
        .toMatchObject({ verifiedFixes: 1 })
      clock = 6
      await post(base + '/api/snapshot', envelope('project-a', 'browser-a', [], '/pricing', clock))
      expect((await json(`${base}/api/projects/${project}/workflow`)).body)
        .toMatchObject({ issues: [{ phase: 'fixed' }] })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
