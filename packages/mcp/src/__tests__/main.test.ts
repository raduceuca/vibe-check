import { afterEach, describe, expect, it } from 'vitest'
import { runMain } from '../main.js'
import { createHubServer, type HubServerContext } from '../hubServer.js'
import type { ProjectSnapshotEnvelope, VibeSnapshot } from '../types.js'

const snapshot: VibeSnapshot = {
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 0, jsTransferKB: 0, cssTransferKB: 0, imageTransferKB: 0, fontTransferKB: 0, resourceCount: 0, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [],
  domNodeCount: 10,
}

let hub: HubServerContext | null = null

const startHub = async (): Promise<string> => {
  hub = createHubServer({ version: '0.2.0' })
  await new Promise<void>((resolve) => hub!.server.listen(0, '127.0.0.1', resolve))
  const address = hub.server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const hubUrl = `http://127.0.0.1:${port}`
  const envelope: ProjectSnapshotEnvelope = {
    projectId: 'project-a',
    instanceId: 'browser-a',
    origin: 'http://localhost:5173',
    pageUrl: 'http://localhost:5173/fixture',
    title: 'Fixture',
    snapshot,
  }
  await fetch(`${hubUrl}/api/snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  return hubUrl
}

afterEach(async () => {
  await hub?.close()
  hub = null
})

describe('runMain', () => {
  it('prints a JSON doctor report and returns a failing diagnostic exit code', async () => {
    const hubUrl = await startHub()
    const stdout: string[] = []
    const result = await runMain(
      ['doctor', '--project', 'project-a', '--json'],
      { VIBE_CHECK_HUB_URL: hubUrl },
      { stdout: (value) => stdout.push(value), stderr: () => undefined },
    )

    expect(result).toEqual({ kind: 'exit', code: 1 })
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      selectedProjectId: 'project-a',
      ok: false,
    })
  })

  it('returns long-running hub and connect configurations without starting them', async () => {
    await expect(runMain(['hub'], {}, { stdout: () => undefined, stderr: () => undefined })).resolves.toEqual({
      kind: 'continue',
      config: { role: 'hub', host: '127.0.0.1', port: 4200 },
    })
    await expect(runMain(['connect'], {}, { stdout: () => undefined, stderr: () => undefined })).resolves.toEqual({
      kind: 'continue',
      config: { role: 'connect', hubUrl: 'http://127.0.0.1:4200' },
    })
  })

  it('runs setup as a finite command and prints actions plus next steps', async () => {
    const stdout: string[] = []
    const setupCalls: unknown[] = []
    const result = await runMain(
      ['setup', '--agent', 'codex', '--project', 'storefront', '--dry-run'],
      {},
      { stdout: (value) => stdout.push(value), stderr: () => undefined },
      {
        cwd: '/tmp/storefront',
        version: '0.3.0',
        runSetup: async (options) => {
          setupCalls.push(options)
          return {
            projectId: 'storefront',
            componentPath: 'src/VibeCheckDevtools.tsx',
            actions: ['Install widget', 'Configure Codex'],
            nextSteps: ['Mount the component', 'Start the hub'],
          }
        },
      },
    )

    expect(result).toEqual({ kind: 'exit', code: 0 })
    expect(setupCalls).toEqual([{
      cwd: '/tmp/storefront',
      agent: 'codex',
      projectId: 'storefront',
      version: '0.3.0',
      dryRun: true,
      force: false,
    }])
    expect(stdout.join('')).toContain('VibeCheck setup — storefront (dry run)')
    expect(stdout.join('')).toContain('1. Install widget')
    expect(stdout.join('')).toContain('1. Mount the component')
  })
})
