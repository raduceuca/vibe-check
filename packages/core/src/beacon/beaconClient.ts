import type {
  DispatchIssueRequest,
  DispatchIssueResponse,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  VibeIssue,
  VibeSnapshot,
} from '../types.js'
import {
  KEEPALIVE_BODY_LIMIT_BYTES,
  fitEnvelopeToBytes,
  measureJsonBytes,
} from '../types.js'

export interface BeaconClientConfig {
  readonly url: string
  readonly intervalMs: number
  readonly projectId?: string
}

/**
 * Why the last snapshot POST failed (since 0.4):
 * - 'hub-offline': nothing answered at the configured hub URL.
 * - 'payload-too-large': the hub answered 413.
 * - 'rejected': the hub answered but did not accept the snapshot (400, 5xx,
 *   any other refusal), or the browser refused to queue the legacy beacon.
 * - 'origin-not-allowed': the hub is running but refuses this page's origin
 *   (a 403 `origin-not-allowed`, or a CORS failure while the hub is reachable).
 */
export type BeaconFailure = 'hub-offline' | 'payload-too-large' | 'rejected' | 'origin-not-allowed'

export interface BeaconStatus {
  readonly configured: boolean
  readonly projectId: string
  readonly instanceId: string
  readonly lastAttemptAt: number | null
  readonly lastOk: boolean | null
  readonly projectStatus: ProjectStatus | null
  /** 'hub-offline' when the last status request could not reach the hub. Kept for 0.3 consumers. */
  readonly statusError: 'hub-offline' | null
  /** Since 0.4. Why the last snapshot attempt failed; null after a success or before the first answer. */
  readonly lastError?: BeaconFailure | null
  /** Since 0.4. Epoch ms of the next attempt while backing off after failures; null when healthy. */
  readonly retryAt?: number | null
}

const STATUS_INTERVAL_MS = 2_000
const ISSUE_DISPATCH_TIMEOUT_MS = 9_000
const REACHABILITY_TIMEOUT_MS = 3_000
// Delay before the next attempt after 1, 2, 3, ... consecutive failures (C17).
// Never shorter than the configured interval.
const BACKOFF_MS: readonly number[] = [2_000, 4_000, 8_000, 16_000, 30_000, 60_000]

const defaultProjectId = (): string =>
  typeof window !== 'undefined' && window.location.origin !== 'null'
    ? window.location.origin
    : 'unknown-project'

const currentPageUrl = (): string =>
  typeof window !== 'undefined' ? window.location.href : ''

const isDocumentHidden = (): boolean =>
  typeof document !== 'undefined' && document.hidden === true

const createInstanceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `instance-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

// Maps a non-2xx hub answer to a failure kind (CONTRACT §3.4 / §3.9).
const failureForResponse = async (response: Response): Promise<BeaconFailure> => {
  if (response.status === 413) return 'payload-too-large'
  if (response.status === 403) {
    const body = await readJson(response)
    if (isRecord(body) && body['code'] === 'origin-not-allowed') return 'origin-not-allowed'
  }
  return 'rejected'
}

const isDispatchResponse = (value: unknown): value is DispatchIssueResponse =>
  isRecord(value) && typeof value['ok'] === 'boolean' && typeof value['code'] === 'string'

export class BeaconClient {
  private readonly config: BeaconClientConfig
  private readonly projectId: string
  private readonly instanceId = createInstanceId()
  private sendTimerId: ReturnType<typeof setTimeout> | undefined = undefined
  private statusIntervalId: ReturnType<typeof setInterval> | undefined = undefined
  private getSnapshot: (() => VibeSnapshot) | null = null
  private lastAttemptAt: number | null = null
  private lastOk: boolean | null = null
  private projectStatus: ProjectStatus | null = null
  private statusError: 'hub-offline' | null = null
  private lastError: BeaconFailure | null = null
  private consecutiveFailures = 0
  private retryAt: number | null = null
  // Set when a scheduled send found the tab hidden; visibilitychange resumes it.
  private pausedWhileHidden = false

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
      lastError: this.lastError,
      retryAt: this.retryAt,
    }
  }

  start(getSnapshot: () => VibeSnapshot): void {
    if (this.getSnapshot !== null) return
    this.getSnapshot = getSnapshot
    this.statusIntervalId = setInterval(this.pollStatus, STATUS_INTERVAL_MS)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.handleVisibility)
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.handlePageHide)
    this.tick()
  }

  stop(): void {
    if (this.sendTimerId !== undefined) clearTimeout(this.sendTimerId)
    if (this.statusIntervalId !== undefined) clearInterval(this.statusIntervalId)
    this.sendTimerId = undefined
    this.statusIntervalId = undefined
    this.getSnapshot = null
    this.retryAt = null
    this.pausedWhileHidden = false
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.handleVisibility)
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.handlePageHide)
  }

  sendNow(): void {
    this.send(false)
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
      pageUrl: currentPageUrl(),
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
      const body = await response.json() as unknown
      if (isDispatchResponse(body)) return body
      // A hub error body ({ error, code, hint }) rather than a dispatch result.
      return this.dispatchFailure(
        isRecord(body) && body['code'] === 'origin-not-allowed' ? 'origin-not-allowed' : 'failed',
      )
    } catch {
      if (controller?.signal.aborted === true) return this.dispatchFailure('failed')
      // A CORS refusal is indistinguishable from a dead hub here; reuse what the
      // snapshot beacon already learned about this hub.
      return this.dispatchFailure(this.lastError === 'origin-not-allowed' ? 'origin-not-allowed' : 'hub-offline')
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  // One routine attempt: no sends while the tab is hidden (C6), and the next
  // attempt is scheduled before sending so a synchronous failure can push it
  // back.
  private readonly tick = (): void => {
    this.sendTimerId = undefined
    if (this.getSnapshot === null) return
    if (isDocumentHidden()) {
      this.pausedWhileHidden = true
      this.retryAt = null
      return
    }
    this.schedule(this.nextDelay())
    this.send(false)
  }

  private nextDelay(): number {
    if (this.consecutiveFailures === 0) return this.config.intervalMs
    const step = BACKOFF_MS[Math.min(this.consecutiveFailures, BACKOFF_MS.length) - 1] ?? 60_000
    return Math.max(this.config.intervalMs, step)
  }

  private schedule(delayMs: number): void {
    if (this.sendTimerId !== undefined) clearTimeout(this.sendTimerId)
    this.sendTimerId = setTimeout(this.tick, delayMs)
    this.retryAt = this.consecutiveFailures > 0 ? Date.now() + delayMs : null
  }

  private readonly handleVisibility = (): void => {
    if (isDocumentHidden() || this.getSnapshot === null) return
    // Back in view: start over with a fresh backoff and a fresh agent state.
    this.consecutiveFailures = 0
    this.retryAt = null
    this.pausedWhileHidden = false
    this.tick()
    void this.refreshStatus()
  }

  // The final send of a page lifetime is the only one that asks for keepalive.
  private readonly handlePageHide = (): void => {
    this.send(true)
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  private dispatchFailure(code: DispatchIssueResponse['code']): DispatchIssueResponse {
    return { ok: false, code, projectId: this.projectId, queueDepth: 0 }
  }

  private envelope(snapshot: VibeSnapshot): ProjectSnapshotEnvelope {
    return {
      projectId: this.projectId,
      instanceId: this.instanceId,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      pageUrl: currentPageUrl(),
      title: typeof document !== 'undefined' ? document.title : '',
      snapshot,
    }
  }

  private send(final: boolean): void {
    if (this.getSnapshot === null) return
    // Bounded to SNAPSHOT_BODY_BUDGET_BYTES; issues dropped to fit are listed
    // in snapshot.truncation so the hub never reads their absence as a fix (C2).
    const envelope = fitEnvelopeToBytes(this.envelope(this.getSnapshot()))
    const payload = JSON.stringify(envelope)
    const endpoint = `${this.config.url}/api/snapshot`
    this.lastAttemptAt = Date.now()

    try {
      if (typeof fetch !== 'undefined') {
        // Browsers reject a keepalive body over 64 KiB outright, and a routine
        // POST has no need to outlive the page, so only the pagehide send asks
        // for keepalive, and only when the body fits.
        const keepalive = final && measureJsonBytes(envelope) <= KEEPALIVE_BODY_LIMIT_BYTES
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive,
        })
          .then((response) => this.handleResponse(response))
          .catch(() => this.handleNetworkFailure())
        return
      }

      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        // A queued beacon is not a confirmed delivery: success leaves lastOk
        // unknown; a refusal to queue is a failure.
        const queued = navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
        if (!queued) this.recordFailure('rejected')
        return
      }
      this.recordFailure('hub-offline')
    } catch {
      this.recordFailure('hub-offline')
    }
  }

  private async handleResponse(response: Response): Promise<void> {
    if (response.ok) {
      this.recordSuccess()
      return
    }
    const failure = await failureForResponse(response)
    this.recordFailure(failure)
    // The hub answered, so one status probe per attempt keeps the agent state
    // current. A refused origin cannot read the status either.
    if (failure !== 'origin-not-allowed') void this.refreshStatus()
  }

  private async handleNetworkFailure(): Promise<void> {
    // fetch reports a CORS refusal exactly like a dead hub. A no-cors request
    // still resolves (opaque) when something is listening, which tells the two
    // apart without reading anything cross-origin.
    const reachable = await this.isHubReachable()
    this.recordFailure(reachable ? 'origin-not-allowed' : 'hub-offline')
  }

  private recordSuccess(): void {
    const wasFailing = this.consecutiveFailures > 0
    const firstSuccess = this.lastOk !== true
    this.lastOk = true
    this.lastError = null
    this.consecutiveFailures = 0
    this.retryAt = null
    // No status refresh after every POST (C6); only on the first success and
    // on recovery, so the agent state shows up without waiting for the poll.
    if (firstSuccess || wasFailing) void this.refreshStatus()
    if (wasFailing && this.getSnapshot !== null && !this.pausedWhileHidden) {
      this.schedule(this.config.intervalMs)
    }
  }

  private recordFailure(failure: BeaconFailure): void {
    this.lastOk = false
    this.lastError = failure
    this.statusError = failure === 'hub-offline' ? 'hub-offline' : null
    this.consecutiveFailures += 1
    if (this.getSnapshot !== null && !this.pausedWhileHidden) this.schedule(this.nextDelay())
  }

  private async isHubReachable(): Promise<boolean> {
    if (typeof fetch === 'undefined') return false
    const controller = typeof AbortController === 'undefined' ? null : new AbortController()
    const timeoutId = controller === null
      ? undefined
      : setTimeout(() => controller.abort(), REACHABILITY_TIMEOUT_MS)
    try {
      const response: unknown = await fetch(`${this.config.url}/api/health`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller?.signal,
      })
      return isRecord(response)
    } catch {
      return false
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  // While snapshots are failing, each attempt does its own status probe, so the
  // regular poll stands down (C17).
  private readonly pollStatus = (): void => {
    if (this.consecutiveFailures > 0) return
    void this.refreshStatus()
  }

  private async refreshStatus(): Promise<void> {
    if (typeof fetch === 'undefined') return
    if (isDocumentHidden()) return
    let response: Response
    try {
      response = await fetch(
        `${this.config.url}/api/projects/${encodeURIComponent(this.projectId)}/status`,
      )
    } catch {
      this.statusError = 'hub-offline'
      return
    }
    // The hub answered: it is not offline, whatever it said.
    this.statusError = null
    if (!response.ok) return
    const body = await readJson(response)
    if (isRecord(body)) this.projectStatus = body as unknown as ProjectStatus
  }
}
