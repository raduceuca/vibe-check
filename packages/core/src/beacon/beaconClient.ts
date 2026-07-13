import type {
  DispatchIssueRequest,
  DispatchIssueResponse,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  VibeIssue,
  VibeSnapshot,
} from '../types.js'

export interface BeaconClientConfig {
  readonly url: string
  readonly intervalMs: number
  readonly projectId?: string
}

export interface BeaconStatus {
  readonly configured: boolean
  readonly projectId: string
  readonly instanceId: string
  readonly lastAttemptAt: number | null
  readonly lastOk: boolean | null
  readonly projectStatus: ProjectStatus | null
  readonly statusError: 'hub-offline' | null
}

const STATUS_INTERVAL_MS = 2_000
const ISSUE_DISPATCH_TIMEOUT_MS = 9_000

const defaultProjectId = (): string =>
  typeof window !== 'undefined' && window.location.origin !== 'null'
    ? window.location.origin
    : 'unknown-project'

const createInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `instance-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export class BeaconClient {
  private readonly config: BeaconClientConfig
  private readonly projectId: string
  private readonly instanceId = createInstanceId()
  private intervalId: ReturnType<typeof setInterval> | undefined = undefined
  private statusIntervalId: ReturnType<typeof setInterval> | undefined = undefined
  private getSnapshot: (() => VibeSnapshot) | null = null
  private lastAttemptAt: number | null = null
  private lastOk: boolean | null = null
  private projectStatus: ProjectStatus | null = null
  private statusError: 'hub-offline' | null = null

  constructor(config: BeaconClientConfig) {
    this.config = config
    this.projectId = config.projectId ?? defaultProjectId()
  }

  getStatus(): BeaconStatus {
    return {
      configured: true,
      projectId: this.projectId,
      instanceId: this.instanceId,
      lastAttemptAt: this.lastAttemptAt,
      lastOk: this.lastOk,
      projectStatus: this.projectStatus,
      statusError: this.statusError,
    }
  }

  start(getSnapshot: () => VibeSnapshot): void {
    this.getSnapshot = getSnapshot
    this.intervalId = setInterval(() => this.send(), this.config.intervalMs)
    this.statusIntervalId = setInterval(() => { void this.refreshStatus() }, STATUS_INTERVAL_MS)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.handleVisibility)
    this.send()
  }

  stop(): void {
    if (this.intervalId !== undefined) clearInterval(this.intervalId)
    if (this.statusIntervalId !== undefined) clearInterval(this.statusIntervalId)
    this.intervalId = undefined
    this.statusIntervalId = undefined
    this.getSnapshot = null
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.handleVisibility)
  }

  sendNow(): void {
    this.send()
  }

  async dispatchIssue(issue: VibeIssue): Promise<DispatchIssueResponse> {
    if (typeof fetch === 'undefined') return this.dispatchFailure('hub-offline')
    const controller = typeof AbortController === 'undefined' ? null : new AbortController()
    const timeoutId = controller === null
      ? undefined
      : setTimeout(() => controller.abort(), ISSUE_DISPATCH_TIMEOUT_MS)
    const request: DispatchIssueRequest = {
      projectId: this.projectId,
      instanceId: this.instanceId,
      issue,
    }
    try {
      const response = await fetch(
        `${this.config.url}/api/projects/${encodeURIComponent(this.projectId)}/dispatch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller?.signal,
        },
      )
      const body = await response.json() as DispatchIssueResponse
      return body
    } catch {
      return this.dispatchFailure(controller?.signal.aborted === true ? 'failed' : 'hub-offline')
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  private readonly handleVisibility = (): void => {
    if (!document.hidden) void this.refreshStatus()
  }

  private dispatchFailure(code: DispatchIssueResponse['code']): DispatchIssueResponse {
    return { ok: false, code, projectId: this.projectId, queueDepth: 0 }
  }

  private envelope(snapshot: VibeSnapshot): ProjectSnapshotEnvelope {
    return {
      projectId: this.projectId,
      instanceId: this.instanceId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      title: typeof document !== 'undefined' ? document.title : '',
      snapshot,
    }
  }

  private async refreshStatus(): Promise<void> {
    if (typeof fetch === 'undefined') return
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const response = await fetch(
        `${this.config.url}/api/projects/${encodeURIComponent(this.projectId)}/status`,
      )
      if (!response.ok) throw new Error(`status ${response.status}`)
      this.projectStatus = await response.json() as ProjectStatus
      this.statusError = null
    } catch {
      this.statusError = 'hub-offline'
    }
  }

  private send(): void {
    if (this.getSnapshot === null) return
    const payload = JSON.stringify(this.envelope(this.getSnapshot()))
    const endpoint = `${this.config.url}/api/snapshot`
    this.lastAttemptAt = Date.now()

    try {
      if (typeof fetch !== 'undefined') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        })
          .then((response) => {
            this.lastOk = response.ok
            if (response.ok) void this.refreshStatus()
          })
          .catch(() => {
            this.lastOk = false
            this.statusError = 'hub-offline'
          })
        return
      }

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
        return
      }
      this.lastOk = false
    } catch {
      this.lastOk = false
      this.statusError = 'hub-offline'
    }
  }
}
