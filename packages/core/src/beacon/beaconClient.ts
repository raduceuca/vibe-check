import type { VibeSnapshot } from '../types.js'

export interface BeaconClientConfig {
  readonly url: string
  readonly intervalMs: number
}

// Real delivery status, so the UI/agent can tell whether snapshots are actually
// reaching the MCP server rather than just "a URL is configured".
export interface BeaconStatus {
  readonly configured: boolean
  // Timestamp of the most recent send attempt (null before the first send).
  readonly lastAttemptAt: number | null
  // Outcome of the most recent attempt: true if delivered/queued, false if it
  // failed, null if no attempt has completed yet.
  readonly lastOk: boolean | null
}

export class BeaconClient {
  private readonly config: BeaconClientConfig
  private intervalId: ReturnType<typeof setInterval> | undefined = undefined
  private getSnapshot: (() => VibeSnapshot) | null = null
  private lastAttemptAt: number | null = null
  private lastOk: boolean | null = null

  constructor(config: BeaconClientConfig) {
    this.config = config
  }

  getStatus(): BeaconStatus {
    return {
      configured: true,
      lastAttemptAt: this.lastAttemptAt,
      lastOk: this.lastOk,
    }
  }

  start(getSnapshot: () => VibeSnapshot): void {
    this.getSnapshot = getSnapshot
    this.intervalId = setInterval(() => {
      this.send()
    }, this.config.intervalMs)
    // Send immediately on start
    this.send()
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.getSnapshot = null
  }

  sendNow(): void {
    this.send()
  }

  private send(): void {
    if (this.getSnapshot === null) return

    const snapshot = this.getSnapshot()
    const endpoint = `${this.config.url}/api/snapshot`
    const payload = JSON.stringify(snapshot)
    this.lastAttemptAt = Date.now()

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' })
        const queued = navigator.sendBeacon(endpoint, blob)
        if (queued) {
          // sendBeacon only confirms the UA queued the payload (e.g. it can be
          // rejected when over ~64KB); treat that as success but fall through
          // to fetch when it refuses so large snapshots are not silently dropped.
          this.lastOk = true
          return
        }
      }

      if (typeof fetch !== 'undefined') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        })
          .then((res) => { this.lastOk = res.ok })
          .catch(() => {
            // Record the failure (the UI surfaces it) but never throw —
            // monitoring must not break the host app.
            this.lastOk = false
          })
      } else {
        this.lastOk = false
      }
    } catch {
      // Silently ignore — monitoring must never break the host app
      this.lastOk = false
    }
  }
}
