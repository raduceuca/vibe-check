import { afterEach, describe, expect, it } from 'vitest'
import { createHubServer, type HubServerContext } from '../hubServer.js'
import type { ProjectSnapshotEnvelope, VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (id = 'dom-1'): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 900 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 900 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const makeSnapshot = (issues: readonly VibeIssue[] = []): VibeSnapshot => ({
  timestamp: 1,
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
})

const envelope = (projectId: string, instanceId: string, issues = [makeIssue()]): ProjectSnapshotEnvelope => ({
  projectId,
  instanceId,
  origin: projectId,
  title: `Fixture ${projectId}`,
  snapshot: makeSnapshot(issues),
})

let context: HubServerContext | null = null

const start = async () => {
  context = createHubServer({ version: '0.2.0' })
  await new Promise<void>((resolve) => context!.server.listen(0, '127.0.0.1', resolve))
  const address = context.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return `http://127.0.0.1:${port}`
}

const json = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init)
  return { response, body: await response.json() as unknown }
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
      version: '0.2.0',
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
    expect(result.body).toEqual({ error: 'Bridge API does not accept browser requests' })
  })

  it('preserves the owner and reports a second-agent conflict to the widget', async () => {
    const base = await start()
    await post(`${base}/api/snapshot`, envelope('project-a', 'a'))
    const project = encodeURIComponent('project-a')

    const owner = await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-a' })
    expect(owner.response.status).toBe(200)
    const conflict = await post(`${base}/internal/projects/${project}/leases/acquire`, { sessionId: 'agent-b' })
    expect(conflict.response.status).toBe(409)
    expect(conflict.body).toMatchObject({ ok: false, code: 'lease-conflict' })

    const status = await json(`${base}/api/projects/${project}/status`)
    expect(status.body).toMatchObject({ state: 'watching' })
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
    const dispatched = await post(`${base}/api/projects/${project}/dispatch`, {
      projectId: 'project-a',
      instanceId: 'a',
      issue,
    })
    expect(dispatched.response.status).toBe(200)

    const received = await waiting
    expect(received.response.status).toBe(200)
    expect(received.body).toMatchObject({ projectId: 'project-a', issue: { id: 'send-me' } })
    const status = await json(`${base}/api/projects/${project}/status`)
    expect(status.body).toMatchObject({ state: 'busy', queueDepth: 0 })
  })

  it('filters active issues and applies acknowledge/resolve per project', async () => {
    const base = await start()
    await post(`${base}/api/snapshot`, envelope('project-a', 'a', [makeIssue('a-1')]))
    const project = encodeURIComponent('project-a')
    const issues = await json(`${base}/internal/projects/${project}/issues?severity=warning`)
    expect(issues.body).toMatchObject([{ id: 'a-1' }])

    await post(`${base}/internal/projects/${project}/issues/a-1/acknowledge`, {})
    expect((await json(`${base}/internal/projects/${project}/issues`)).body).toEqual([])
    await post(`${base}/internal/projects/${project}/issues/a-1/resolve`, {})
    expect((await json(`${base}/internal/projects/${project}/issues/a-1`)).body).toMatchObject({ id: 'a-1' })
  })
})
