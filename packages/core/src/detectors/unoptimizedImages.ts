import type { Detector, VibeIssue } from '../types.js'
import { hasMutationObserver } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Types ────────────────────────────────────────────────────────────────────

type ImageIssueType = 'missing-lazy' | 'missing-dimensions' | 'oversized'

// ── Helpers ──────────────────────────────────────────────────────────────────

const isBelowFold = (img: HTMLImageElement): boolean => {
  try {
    const rect = img.getBoundingClientRect()
    return rect.top > window.innerHeight
  } catch {
    return false
  }
}

const truncateSrc = (src: string, maxLen = 120): string =>
  src.length > maxLen ? src.slice(0, maxLen) + '...' : src

// ── Detector ─────────────────────────────────────────────────────────────────

export const createUnoptimizedImagesDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let observer: MutationObserver | null = null
  const checkedSrcs = new Set<string>()

  const reportIssue = (
    img: HTMLImageElement,
    issueType: ImageIssueType,
    details: Record<string, unknown>,
  ): void => {
    const src = truncateSrc(img.src || img.getAttribute('src') || 'unknown')
    const key = `${issueType}:${src}`

    if (checkedSrcs.has(key)) return
    checkedSrcs.add(key)

    const severity = issueType === 'missing-dimensions' ? 'error' : 'warning'
    const titles: Record<ImageIssueType, string> = {
      'missing-lazy': 'Image missing lazy loading',
      'missing-dimensions': 'Image missing width/height',
      'oversized': 'Oversized image detected',
    }
    const descriptions: Record<ImageIssueType, string> = {
      'missing-lazy': `Below-fold image "${src}" is missing loading="lazy". This forces the browser to download it immediately, blocking the critical rendering path.`,
      'missing-dimensions': `Image "${src}" is missing explicit width or height attributes. This causes layout shifts (CLS) when the image loads.`,
      'oversized': `Image "${src}" has a natural size much larger than its rendered size. Consider serving a resized version to save bandwidth.`,
    }

    issues = [
      ...issues,
      createIssue(
        'unoptimized-images',
        severity,
        titles[issueType],
        descriptions[issueType],
        { src, issue: issueType, ...details },
      ),
    ]
  }

  const checkImage = (img: HTMLImageElement): void => {
    // Missing loading="lazy" for below-fold images
    if (img.getAttribute('loading') !== 'lazy' && isBelowFold(img)) {
      reportIssue(img, 'missing-lazy', {
        topOffset: Math.round(img.getBoundingClientRect().top),
        viewportHeight: window.innerHeight,
      })
    }

    // Missing width or height attributes (causes CLS)
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      reportIssue(img, 'missing-dimensions', {
        hasWidth: img.hasAttribute('width'),
        hasHeight: img.hasAttribute('height'),
      })
    }

    // Oversized: natural dimensions > 2x rendered dimensions
    // Only check if the image has loaded (naturalWidth > 0)
    if (img.naturalWidth > 0 && img.width > 0) {
      if (img.naturalWidth > 2 * img.width) {
        reportIssue(img, 'oversized', {
          naturalWidth: img.naturalWidth,
          renderedWidth: img.width,
          ratio: Math.round((img.naturalWidth / img.width) * 10) / 10,
        })
      }
    }
  }

  const scanExistingImages = (): void => {
    if (typeof document === 'undefined') return
    const images = document.querySelectorAll('img')
    images.forEach((img) => checkImage(img))
  }

  const handleMutations = (mutations: MutationRecord[]): void => {
    for (const mutation of mutations) {
      for (let i = 0; i < mutation.addedNodes.length; i++) {
        const node = mutation.addedNodes[i]
        if (node instanceof HTMLImageElement) {
          checkImage(node)
        }
        // Also check img elements inside added containers
        if (node instanceof HTMLElement) {
          const nestedImages = node.querySelectorAll('img')
          nestedImages.forEach((img) => checkImage(img))
        }
      }
    }
  }

  return {
    name: 'unoptimized-images',

    start(): void {
      if (!hasMutationObserver()) return
      if (observer !== null) return

      // Scan existing images first
      scanExistingImages()

      // Watch for new images
      observer = new MutationObserver(handleMutations)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
    },

    stop(): void {
      if (observer !== null) {
        observer.disconnect()
        observer = null
      }
      checkedSrcs.clear()
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      checkedSrcs.clear()
    },
  }
}
