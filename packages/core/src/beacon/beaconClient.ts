import type { VibeSnapshot } from '../types.js'

export interface BeaconClientConfig {
  readonly url: string
  readonly intervalMs: number
}

export class BeaconClient {
  private readonly config: BeaconClientConfig
  private intervalId: ReturnType<typeof setInterval> | undefined = undefined
  private getSnapshot: (() => VibeSnapshot) | null = null

  constructor(config: BeaconClientConfig) {
    this.config = config
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

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(snapshot)], {
          type: 'application/json',
        })
        navigator.sendBeacon(`${this.config.url}/api/snapshot`, blob)
      } else if (typeof fetch !== 'undefined') {
        fetch(`${this.config.url}/api/snapshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
          keepalive: true,
        }).catch(() => {
          // Silently ignore beacon failures — monitoring should never break the app
        })
      }
    } catch {
      // Silently ignore — monitoring must never break the host app
    }
  }
}
