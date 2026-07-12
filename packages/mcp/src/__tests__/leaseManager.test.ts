import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLeaseManager } from '../leaseManager.js'
import type { HubClient } from '../hubClient.js'

const makeClient = (): HubClient => ({
  health: vi.fn(),
  listProjects: vi.fn(),
  getSnapshot: vi.fn(),
  getDetectedIssues: vi.fn(),
  getIssue: vi.fn(),
  waitForSnapshot: vi.fn(),
  acquireLease: vi.fn(async (projectId: string) => ({ ok: true as const, projectId, expiresAt: 15_000 })),
  heartbeatLease: vi.fn(async (projectId: string) => ({ ok: true as const, projectId, expiresAt: 15_000 })),
  releaseLease: vi.fn(async () => {}),
  waitForIssue: vi.fn(),
  acknowledgeIssue: vi.fn(),
  resolveIssue: vi.fn(),
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LeaseManager', () => {
  it('heartbeats and releases its single project', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    const manager = createLeaseManager(client, 'agent-a')

    await expect(manager.acquire('project-a')).resolves.toMatchObject({ ok: true })
    expect(manager.currentProjectId()).toBe('project-a')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(client.heartbeatLease).toHaveBeenCalledTimes(2)

    await manager.stop()
    expect(client.releaseLease).toHaveBeenCalledWith('project-a', 'agent-a')
    expect(manager.currentProjectId()).toBeNull()
  })

  it('rejects a second project locally without calling the hub', async () => {
    const client = makeClient()
    const manager = createLeaseManager(client, 'agent-a')
    await manager.acquire('project-a')

    await expect(manager.acquire('project-b')).resolves.toEqual({
      ok: false,
      code: 'session-already-watching',
      projectId: 'project-a',
    })
    expect(client.acquireLease).toHaveBeenCalledTimes(1)
    await manager.stop()
  })

  it('drops ownership when a heartbeat loses the lease', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    vi.mocked(client.heartbeatLease).mockRejectedValueOnce(new Error('lease lost'))
    const manager = createLeaseManager(client, 'agent-a')
    await manager.acquire('project-a')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(manager.currentProjectId()).toBeNull()
  })
})
