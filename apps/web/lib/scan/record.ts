import type { ScanResult } from './types'

// ── Server-side scan recorder ────────────────────────────────────────────────
// Fire-and-forget POST of a successful scan to the scan-worker's /record route.
// Runs server-to-server only: the shared secret (SCAN_WORKER_SECRET) is read
// from the server environment and NEVER reaches the client. A recording failure
// must never break the scan response, so every path here is swallowed.

const RECORD_TIMEOUT_MS = 2500

// Only real, non-empty scans are worth recording.
const isRecordable = (result: ScanResult): boolean =>
  result.seo.total + result.aeo.total > 0

export const recordScan = async (result: ScanResult): Promise<void> => {
  const base = process.env.SCAN_WORKER_URL
  const secret = process.env.SCAN_WORKER_SECRET

  // Not configured → silently skip (feature is optional).
  if (!base || !secret) return
  if (!isRecordable(result)) return

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RECORD_TIMEOUT_MS)

  try {
    await fetch(`${base.replace(/\/$/, '')}/record`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-scan-secret': secret,
      },
      // Send the final (post-redirect) url + host. The worker strips everything
      // down to a bare hostname before storing, but we avoid leaking a path here
      // regardless by passing origin-only.
      body: JSON.stringify({
        url: result.url,
        host: safeHost(result.url),
        seo: { passed: result.seo.passed, total: result.seo.total },
        aeo: { passed: result.aeo.passed, total: result.aeo.total },
      }),
      signal: controller.signal,
    })
  } catch (error) {
    // Recording is best-effort; log server-side and move on.
    console.error('scan record failed:', error)
  } finally {
    clearTimeout(timer)
  }
}

const safeHost = (url: string): string => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
