import type { Detector, VibeIssue } from '../types.js'
import { hasResourceTiming } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

// In dev mode (unminified bundles), 100KB is normal. Raise threshold.
const isDevMode = (): boolean => {
  try {
    // Vite, Webpack, Parcel all set NODE_ENV
    // Also check for common dev server indicators in the URL
    if (typeof location !== 'undefined') {
      const host = location.hostname
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true
    }
  } catch {
    // SSR or restricted context
  }
  return false
}

const LARGE_RESOURCE_THRESHOLD_KB_PROD = 100
const LARGE_RESOURCE_THRESHOLD_KB_DEV = 500
const SCAN_INTERVAL_MS = 10_000

// ── Types ────────────────────────────────────────────────────────────────────

interface ResourceEntry extends PerformanceEntry {
  readonly transferSize: number
  readonly initiatorType: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const isJsOrCss = (entry: ResourceEntry): boolean => {
  const type = entry.initiatorType
  if (type === 'script' || type === 'css' || type === 'link') return true

  // Also check by URL extension as fallback
  const url = entry.name
  return url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.mjs')
}

const getResourceType = (entry: ResourceEntry): string => {
  if (entry.initiatorType === 'script' || entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
    return 'js'
  }
  if (entry.initiatorType === 'css' || entry.initiatorType === 'link' || entry.name.endsWith('.css')) {
    return 'css'
  }
  return entry.initiatorType
}

const truncateUrl = (url: string, maxLen = 120): string =>
  url.length > maxLen ? url.slice(0, maxLen) + '...' : url

// ── Detector ─────────────────────────────────────────────────────────────────

export const createResourceBloatDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let timerId: ReturnType<typeof setInterval> | null = null
  const reportedUrls = new Set<string>()
  const thresholdKB = isDevMode() ? LARGE_RESOURCE_THRESHOLD_KB_DEV : LARGE_RESOURCE_THRESHOLD_KB_PROD

  const scan = (): void => {
    if (typeof performance === 'undefined') return

    const entries = performance.getEntriesByType('resource') as ResourceEntry[]

    for (const entry of entries) {
      if (!isJsOrCss(entry)) continue

      const transferSizeKB = entry.transferSize / 1024
      if (transferSizeKB < thresholdKB) continue

      const url = entry.name
      if (reportedUrls.has(url)) continue
      reportedUrls.add(url)

      const type = getResourceType(entry)

      issues = [
        ...issues,
        createIssue(
          'resource-bloat',
          'warning',
          `Large ${type.toUpperCase()} resource (${Math.round(transferSizeKB)}KB)`,
          `${truncateUrl(url)} transferred ${Math.round(transferSizeKB)}KB. Consider code-splitting, tree-shaking, or compression to reduce bundle size.`,
          {
            url,
            transferSizeKB: Math.round(transferSizeKB * 10) / 10,
            type,
          },
        ),
      ]
    }
  }

  return {
    name: 'resource-bloat',

    start(): void {
      if (!hasResourceTiming()) return

      // Scan once immediately for already-loaded resources
      scan()

      // Periodic re-scan for dynamically loaded resources
      timerId = setInterval(scan, SCAN_INTERVAL_MS)
    },

    stop(): void {
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
      reportedUrls.clear()
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      reportedUrls.clear()
    },
  }
}
