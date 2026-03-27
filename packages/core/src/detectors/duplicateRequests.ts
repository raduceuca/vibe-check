import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DUPLICATE_WINDOW_MS = 2_000

// ── Types ────────────────────────────────────────────────────────────────────

interface RequestRecord {
  readonly timestamps: number[]
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createDuplicateRequestsDetector = (): Detector => {
  let issues: VibeIssue[] = []
  const requestMap = new Map<string, RequestRecord>()
  const reportedKeys = new Set<string>()

  // Saved originals for restoration
  let originalFetch: typeof globalThis.fetch | null = null
  let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null
  let patched = false

  const trackRequest = (method: string, url: string): void => {
    const key = `${method.toUpperCase()}:${url}`
    const now = Date.now()

    const existing = requestMap.get(key)
    // Build new timestamps array (immutable pattern, but we reuse the internal list
    // since it's private to the detector)
    const timestamps = existing
      ? [...existing.timestamps.filter((t) => now - t < DUPLICATE_WINDOW_MS), now]
      : [now]

    requestMap.set(key, { timestamps })

    if (timestamps.length >= 2 && !reportedKeys.has(key)) {
      reportedKeys.add(key)
      issues = [
        ...issues,
        createIssue(
          'duplicate-requests',
          'warning',
          `Duplicate ${method.toUpperCase()} request`,
          `${url} was called ${timestamps.length} times within ${DUPLICATE_WINDOW_MS}ms. This may indicate unnecessary refetching or missing request deduplication.`,
          {
            url,
            method: method.toUpperCase(),
            count: timestamps.length,
            windowMs: DUPLICATE_WINDOW_MS,
          },
        ),
      ]
    }
  }

  const patchFetch = (): void => {
    if (typeof globalThis.fetch === 'undefined') return

    // Save whatever is currently assigned (may already be patched by another tool)
    originalFetch = globalThis.fetch

    const wrappedFetch: typeof globalThis.fetch = (input, init?) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url
      const method = init?.method ?? 'GET'
      trackRequest(method, url)
      return originalFetch!(input, init)
    }

    globalThis.fetch = wrappedFetch
  }

  const patchXhr = (): void => {
    if (typeof XMLHttpRequest === 'undefined') return

    originalXhrOpen = XMLHttpRequest.prototype.open

    const wrappedOpen = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      trackRequest(method, url.toString())
      // Call through to the original open with all arguments
      return originalXhrOpen!.apply(this, [method, url, ...rest] as unknown as Parameters<typeof XMLHttpRequest.prototype.open>)
    }

    XMLHttpRequest.prototype.open = wrappedOpen as typeof XMLHttpRequest.prototype.open
  }

  return {
    name: 'duplicate-requests',

    start(): void {
      if (patched) return
      patched = true
      patchFetch()
      patchXhr()
    },

    stop(): void {
      try {
        if (originalFetch !== null) {
          globalThis.fetch = originalFetch
          originalFetch = null
        }
        if (originalXhrOpen !== null) {
          XMLHttpRequest.prototype.open = originalXhrOpen
          originalXhrOpen = null
        }
      } finally {
        patched = false
        requestMap.clear()
        reportedKeys.clear()
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      reportedKeys.clear()
      requestMap.clear()
    },
  }
}
