import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

const SIZE_THRESHOLD_KB = 500
const CHECK_INTERVAL_MS = 5_000
// Bound the reported-src set so a long-lived SPA swapping many images can't grow
// it without limit.
const MAX_TRACKED_SRCS = 500

// A URL's last path segment is a filename only when it has a short extension.
// CDN/placeholder URLs (picsum.photos/2400/1200) have none, so fall back to the
// intrinsic dimensions instead of surfacing "1200" as if it were a name.
const imageDisplayName = (src: string, naturalW: number, naturalH: number): string => {
  const last = src.split('?')[0].split('#')[0].split('/').pop() ?? ''
  if (/\.[a-z0-9]{2,5}$/i.test(last)) return last
  return naturalW > 0 && naturalH > 0 ? `${naturalW}×${naturalH} image` : 'image'
}

export const createLargeImagesDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let timerId: ReturnType<typeof setInterval> | null = null
  const reportedSrcs = new Set<string>()

  const trackSrc = (src: string): void => {
    reportedSrcs.add(src)
    if (reportedSrcs.size > MAX_TRACKED_SRCS) {
      const oldest = reportedSrcs.values().next().value
      if (oldest !== undefined) reportedSrcs.delete(oldest)
    }
  }

  const checkImages = (): void => {
    if (typeof document === 'undefined') return

    const images = document.querySelectorAll('img')
    for (const img of images) {
      const src = img.currentSrc || img.src
      if (!src || reportedSrcs.has(src)) continue

      // Check via Resource Timing API for transfer size
      const entries = performance.getEntriesByName(src) as PerformanceResourceTiming[]
      const entry = entries[entries.length - 1]
      if (!entry || entry.transferSize === 0) continue // cached or no data

      const transferKB = entry.transferSize / 1024

      if (transferKB >= SIZE_THRESHOLD_KB) {
        trackSrc(src)

        const renderedW = img.clientWidth || img.width
        const renderedH = img.clientHeight || img.height
        const naturalW = img.naturalWidth
        const naturalH = img.naturalHeight
        const name = imageDisplayName(src, naturalW, naturalH)

        issues = [
          ...issues,
          createIssue(
            'large-images',
            transferKB >= 1024 ? 'error' : 'warning',
            `Large image: ${Math.round(transferKB)}KB`,
            `Image "${name}" is ${Math.round(transferKB)}KB (${naturalW}x${naturalH} rendered at ${renderedW}x${renderedH}). Consider compressing to WebP/AVIF, resizing to match render dimensions, or using a CDN with transforms.`,
            {
              src,
              transferSizeKB: Math.round(transferKB),
              naturalWidth: naturalW,
              naturalHeight: naturalH,
              renderedWidth: renderedW,
              renderedHeight: renderedH,
              format: src.split('.').pop()?.split('?')[0] ?? 'unknown',
            },
          ),
        ]
      }
    }
  }

  return {
    name: 'large-images',

    start(): void {
      checkImages()
      timerId = setInterval(checkImages, CHECK_INTERVAL_MS)
    },

    stop(): void {
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      reportedSrcs.clear()
    },
  }
}
