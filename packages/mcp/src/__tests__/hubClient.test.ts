import { afterEach, describe, expect, it } from 'vitest'
import { createHubClient, HubClientError } from '../hubClient.js'
import { createHubServer, type HubServerContext } from '../hubServer.js'
import type { ProjectSnapshotEnvelope, VibeSnapshot } from '../types.js'

const snapshot: VibeSnapshot = {
  timestamp: 1,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 0, jsTransferKB: 0, cssTransferKB: 0, imageTransferKB: 0, fontTransferKB: 0, resourceCount: 0, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [],
  domNodeCount: 10,
}

let context: HubServerContext | null = null

const start = async () => {
  context = createHubServer({ version: '0.2.0' })
  await new Promise<void>((resolve) => context!.server.listen(0, '127.0.0.1', resolve))
  const address = context.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return `http://127.0.0.1:${port}`
}

afterEach(async () => {
  await context?.close()
  context = null
})

describe('HubClient', () => {
  it('uses the real hub API for projects, snapshots, and leases', async () => {
    const baseUrl = await start()
    const envelope: ProjectSnapshotEnvelope = {
      projectId: 'project-a',
      instanceId: 'browser-a',
      origin: 'http://localhost:5173',
      title: 'Fixture',
      snapshot,
    }
    await fetch(`${baseUrl}/api/snapshot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    })

    const client = createHubClient(baseUrl)
    await expect(client.health()).resolves.toEqual({ status: 'ok', service: 'vibe-check-hub', version: '0.2.0' })
    await expect(client.listProjects()).resolves.toMatchObject([{ projectId: 'project-a' }])
    await expect(client.getSnapshot('project-a')).resolves.toMatchObject({ domNodeCount: 10 })
    await expect(client.getProjectStatus('project-a')).resolves.toMatchObject({
      projectId: 'project-a',
      state: 'no-agent',
      queueDepth: 0,
    })
    await expect(client.acquireLease('project-a', 'agent-a')).resolves.toMatchObject({ ok: true })
    await expect(client.heartbeatLease('project-a', 'agent-a')).resolves.toMatchObject({ ok: true })
    await expect(client.releaseLease('project-a', 'agent-a')).resolves.toBeUndefined()
  })

  it('preserves structured hub errors', async () => {
    const client = createHubClient(await start())
    await expect(client.acquireLease('missing', 'agent-a')).rejects.toMatchObject({
      name: 'HubClientError',
      status: 409,
      code: 'project-not-found',
    } satisfies Partial<HubClientError>)
  })

  it('rejects a non-VibeCheck process on the configured port', async () => {
    const server = await start()
    const client = createHubClient(`${server}/not-the-hub`)
    await expect(client.health()).rejects.toBeInstanceOf(HubClientError)
  })
})
