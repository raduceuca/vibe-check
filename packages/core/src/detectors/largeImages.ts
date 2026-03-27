import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

const SIZE_THRESHOLD_KB = 500
const CHECK_INTERVAL_MS = 5_000

export const createLargeImagesDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let timerId: ReturnType<typeof setInterval> | null = null
  const reportedSrcs = new Set<string>()

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
        reportedSrcs.add(src)

        const renderedW = img.clientWidth || img.width
        const renderedH = img.clientHeight || img.height
        const naturalW = img.naturalWidth
        const naturalH = img.naturalHeight

        issues = [
          ...issues,
          createIssue(
            'large-images',
            transferKB >= 1024 ? 'error' : 'warning',
            `Large image: ${Math.round(transferKB)}KB`,
            `Image "${src.split('/').pop()}" is ${Math.round(transferKB)}KB (${naturalW}x${naturalH} rendered at ${renderedW}x${renderedH}). Consider compressing to WebP/AVIF, resizing to match render dimensions, or using a CDN with transforms.`,
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
