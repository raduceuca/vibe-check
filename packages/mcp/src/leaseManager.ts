import { LEASE_HEARTBEAT_MS } from './hubStore.js'
import type { HubClient } from './hubClient.js'
import type { LeaseResult } from './types.js'

export interface LeaseManager {
  readonly sessionId: string
  currentProjectId(): string | null
  acquire(projectId: string): Promise<LeaseResult>
  release(): Promise<void>
  stop(): Promise<void>
}

export const createLeaseManager = (client: HubClient, sessionId: string): LeaseManager => {
  let projectId: string | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const clearHeartbeat = (): void => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const loseOwnership = (): void => {
    clearHeartbeat()
    projectId = null
  }

  const heartbeat = async (): Promise<void> => {
    if (projectId === null) return
    try {
      const result = await client.heartbeatLease(projectId, sessionId)
      if (!result.ok) loseOwnership()
    } catch {
      loseOwnership()
    }
  }

  const startHeartbeat = (): void => {
    if (heartbeatTimer !== null) return
    heartbeatTimer = setInterval(() => { void heartbeat() }, LEASE_HEARTBEAT_MS)
  }

  const release = async (): Promise<void> => {
    const owned = projectId
    loseOwnership()
    if (owned !== null) await client.releaseLease(owned, sessionId)
  }

  return {
    sessionId,

    currentProjectId(): string | null {
      return projectId
    },

    async acquire(requestedProjectId): Promise<LeaseResult> {
      if (projectId !== null && projectId !== requestedProjectId) {
        return {
          ok: false,
          code: 'session-already-watching',
          projectId,
        }
      }
      const result = await client.acquireLease(requestedProjectId, sessionId)
      if (result.ok) {
        projectId = requestedProjectId
        startHeartbeat()
      }
      return result
    },

    release,
    stop: release,
  }
}
