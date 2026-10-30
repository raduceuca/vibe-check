import { MAX_WATCH_WAIT_SECONDS } from '@wcgw/vibe-check-protocol'
import type {
  DeliveryReceiptResult,
  DetectorName,
  IssueActionResult,
  IssueVerificationStatus,
  LeaseResult,
  ProjectSummary,
  ProjectStatus,
  ProjectImpactSummary,
  ProjectWorkflow,
  QueuedIssue,
  Severity,
  VibeIssue,
  VibeSnapshot,
} from './types.js'

interface HubHealth {
  readonly status: 'ok'
  readonly service: 'vibe-check-hub'
  readonly version: string
}

export class HubClientError extends Error {
  readonly status: number
  readonly code: string
  readonly body: unknown

  constructor(status: number, code: string, body: unknown) {
    super(`VibeCheck hub request failed (${status}: ${code})`)
    this.name = 'HubClientError'
    this.status = status
    this.code = code
    this.body = body
  }
}

export interface HubClient {
  health(): Promise<HubHealth>
  listProjects(): Promise<readonly ProjectSummary[]>
  getSnapshot(projectId: string): Promise<VibeSnapshot | null>
  getProjectStatus(projectId: string): Promise<ProjectStatus | null>
  getWorkflow(projectId: string): Promise<ProjectWorkflow | null>
  getProjectImpact(projectId: string): Promise<ProjectImpactSummary | null>
  resetProjectImpact(projectId: string): Promise<void>
  requestVerification(projectId: string, issueId: string): Promise<IssueActionResult>
  getDetectedIssues(
    projectId: string,
    filters?: { readonly severity?: Severity; readonly detector?: DetectorName },
  ): Promise<readonly VibeIssue[]>
  getIssue(projectId: string, issueId: string): Promise<VibeIssue | null>
  waitForSnapshot(
    projectId: string,
    sessionId: string,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<VibeSnapshot | null>
  acquireLease(projectId: string, sessionId: string, clientName?: string): Promise<LeaseResult>
  heartbeatLease(projectId: string, sessionId: string): Promise<LeaseResult>
  releaseLease(projectId: string, sessionId: string): Promise<void>
  waitForIssue(
    projectId: string,
    sessionId: string,
    timeoutSeconds: number,
    signal?: AbortSignal,
  ): Promise<QueuedIssue | null>
  confirmDelivery(
    projectId: string,
    sessionId: string,
    deliveryId: string,
  ): Promise<DeliveryReceiptResult>
  returnDelivery(
    projectId: string,
    sessionId: string,
    deliveryId: string,
  ): Promise<DeliveryReceiptResult>
  acknowledgeIssue(
    projectId: string,
    sessionId: string,
    issueId: string,
  ): Promise<IssueActionResult>
  resolveIssue(
    projectId: string,
    sessionId: string,
    issueId: string,
  ): Promise<IssueActionResult>
  getVerificationStatus(
    projectId: string,
    issueId: string,
  ): Promise<IssueVerificationStatus | null>
}

const errorCode = (body: unknown): string => {
  if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') {
    return body.code
  }
  return 'request-failed'
}

const clampWatchSeconds = (timeoutSeconds: number): number =>
  Math.min(Math.max(1, Math.floor(timeoutSeconds)), MAX_WATCH_WAIT_SECONDS)

export const createHubClient = (inputBaseUrl: string): HubClient => {
  const baseUrl = inputBaseUrl.replace(/\/$/, '')
  const projectPath = (projectId: string): string =>
    `/internal/projects/${encodeURIComponent(projectId)}`

  const request = async <T>(
    path: string,
    init?: RequestInit,
    allowNotFound = false,
  ): Promise<T | null> => {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, init)
    } catch (error) {
      if (init?.signal?.aborted) throw error
      throw new HubClientError(0, 'hub-offline', error)
    }
    const body = await response.json().catch(() => null) as unknown
    if (allowNotFound && response.status === 404) return null
    if (!response.ok) throw new HubClientError(response.status, errorCode(body), body)
    return body as T
  }

  const post = <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T | null> =>
    request<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    })

  const postLease = async (path: string, body: unknown): Promise<LeaseResult> => {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new HubClientError(0, 'hub-offline', error)
    }
    const payload = await response.json().catch(() => null) as unknown
    // 409 lease-conflict / project-not-found / session-already-watching resolve as LeaseResult.
    if (response.ok || response.status === 409) {
      return payload as LeaseResult
    }
    throw new HubClientError(response.status, errorCode(payload), payload)
  }

  const postAction = async (path: string, body: unknown): Promise<IssueActionResult> => {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new HubClientError(0, 'hub-offline', error)
    }
    const payload = await response.json().catch(() => null) as unknown
    if (response.ok || response.status === 404 || response.status === 409) {
      return payload as IssueActionResult
    }
    throw new HubClientError(response.status, errorCode(payload), payload)
  }

  const postReceipt = async (path: string, body: unknown): Promise<DeliveryReceiptResult> => {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new HubClientError(0, 'hub-offline', error)
    }
    const payload = await response.json().catch(() => null) as unknown
    if (response.ok || response.status === 404 || response.status === 409) {
      return payload as DeliveryReceiptResult
    }
    throw new HubClientError(response.status, errorCode(payload), payload)
  }

  return {
    async health(): Promise<HubHealth> {
      const result = await request<HubHealth>('/api/health')
      if (!result || result.service !== 'vibe-check-hub' || result.status !== 'ok') {
        throw new HubClientError(200, 'not-vibe-check-hub', result)
      }
      return result
    },

    async listProjects(): Promise<readonly ProjectSummary[]> {
      return await request<readonly ProjectSummary[]>('/internal/projects') ?? []
    },

    async getSnapshot(projectId): Promise<VibeSnapshot | null> {
      return await request<VibeSnapshot | null>(`${projectPath(projectId)}/snapshot`)
    },

    async getProjectStatus(projectId): Promise<ProjectStatus | null> {
      return await request<ProjectStatus>(
        `/api/projects/${encodeURIComponent(projectId)}/status`,
        undefined,
        true,
      )
    },

    async getWorkflow(projectId): Promise<ProjectWorkflow | null> {
      return await request<ProjectWorkflow>(
        `/api/projects/${encodeURIComponent(projectId)}/workflow`,
        undefined,
        true,
      )
    },

    async getProjectImpact(projectId): Promise<ProjectImpactSummary | null> {
      return await request<ProjectImpactSummary>(
        `/api/projects/${encodeURIComponent(projectId)}/impact`,
        undefined,
        true,
      )
    },

    async resetProjectImpact(projectId): Promise<void> {
      await post(`/api/projects/${encodeURIComponent(projectId)}/impact/reset`, {})
    },

    async requestVerification(projectId, issueId): Promise<IssueActionResult> {
      return postAction(
        `/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/verify`,
        {},
      )
    },

    async getDetectedIssues(projectId, filters = {}): Promise<readonly VibeIssue[]> {
      const search = new URLSearchParams()
      if (filters.severity) search.set('severity', filters.severity)
      if (filters.detector) search.set('detector', filters.detector)
      const suffix = search.size > 0 ? `?${search.toString()}` : ''
      return await request<readonly VibeIssue[]>(`${projectPath(projectId)}/issues${suffix}`) ?? []
    },

    async getIssue(projectId, issueId): Promise<VibeIssue | null> {
      return await request<VibeIssue>(
        `${projectPath(projectId)}/issues/${encodeURIComponent(issueId)}`,
        undefined,
        true,
      )
    },

    async waitForSnapshot(projectId, sessionId, timeoutSeconds, signal): Promise<VibeSnapshot | null> {
      return await post<VibeSnapshot | null>(`${projectPath(projectId)}/snapshots/next`, {
        sessionId,
        timeoutSeconds: clampWatchSeconds(timeoutSeconds),
      }, signal)
    },

    async acquireLease(projectId, sessionId, clientName): Promise<LeaseResult> {
      return postLease(`${projectPath(projectId)}/leases/acquire`, {
        sessionId,
        ...(clientName ? { clientName } : {}),
      })
    },

    async heartbeatLease(projectId, sessionId): Promise<LeaseResult> {
      return postLease(`${projectPath(projectId)}/leases/heartbeat`, { sessionId })
    },

    async releaseLease(projectId, sessionId): Promise<void> {
      await post(`${projectPath(projectId)}/leases/release`, { sessionId })
    },

    async waitForIssue(projectId, sessionId, timeoutSeconds, signal): Promise<QueuedIssue | null> {
      return await post<QueuedIssue | null>(`${projectPath(projectId)}/issues/next`, {
        sessionId,
        timeoutSeconds: clampWatchSeconds(timeoutSeconds),
      }, signal)
    },

    async confirmDelivery(projectId, sessionId, deliveryId): Promise<DeliveryReceiptResult> {
      return postReceipt(
        `${projectPath(projectId)}/deliveries/${encodeURIComponent(deliveryId)}/ack`,
        { sessionId, deliveryId },
      )
    },

    async returnDelivery(projectId, sessionId, deliveryId): Promise<DeliveryReceiptResult> {
      return postReceipt(
        `${projectPath(projectId)}/deliveries/${encodeURIComponent(deliveryId)}/nack`,
        { sessionId, deliveryId },
      )
    },

    async acknowledgeIssue(projectId, sessionId, issueId): Promise<IssueActionResult> {
      return postAction(
        `${projectPath(projectId)}/issues/${encodeURIComponent(issueId)}/acknowledge`,
        { sessionId },
      )
    },

    async resolveIssue(projectId, sessionId, issueId): Promise<IssueActionResult> {
      return postAction(
        `${projectPath(projectId)}/issues/${encodeURIComponent(issueId)}/resolve`,
        { sessionId },
      )
    },

    async getVerificationStatus(projectId, issueId): Promise<IssueVerificationStatus | null> {
      return await request<IssueVerificationStatus>(
        `${projectPath(projectId)}/issues/${encodeURIComponent(issueId)}/verification`,
        undefined,
        true,
      )
    },
  }
}
