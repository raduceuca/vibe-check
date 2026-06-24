import type { Detector, VibeIssue } from '../types.js'
import { hasMutationObserver } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Types ────────────────────────────────────────────────────────────────────

type ImageIssueType = 'missing-lazy' | 'missing-dimensions' | 'oversized' | 'missing-alt' | 'distorted'

// Declared vs natural aspect ratios diverging beyond this fraction read as
// stretched/squished — a wrongly declared size.
const ASPECT_TOLERANCE = 0.15

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

const PROBLEM_DESCRIPTIONS: Record<ImageIssueType, string> = {
  'missing-lazy': 'missing loading="lazy" (below the fold, so it blocks the critical render path)',
  'missing-dimensions': 'missing width/height attributes (causes layout shift / CLS)',
  'oversized': 'natural size much larger than its rendered size (wastes bandwidth)',
  'missing-alt': 'no alt text (screen readers and search engines can\'t describe it)',
  'distorted': 'declared width/height don\'t match the file\'s real aspect ratio (it\'s stretched or squished)',
}

export const createUnoptimizedImagesDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let observer: MutationObserver | null = null
  // Keyed by src: one consolidated issue per image, not one per problem, so an
  // image with several faults produces a single annotation instead of N
  // near-identical ones.
  const checkedSrcs = new Set<string>()

  const checkImage = (img: HTMLImageElement): void => {
    const src = truncateSrc(img.src || img.getAttribute('src') || 'unknown')
    if (checkedSrcs.has(src)) return

    const problems: ImageIssueType[] = []

    // Missing loading="lazy" for below-fold images
    if (img.getAttribute('loading') !== 'lazy' && isBelowFold(img)) {
      problems.push('missing-lazy')
    }
    // Missing width or height attributes (causes CLS)
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      problems.push('missing-dimensions')
    }
    // Oversized: natural dimensions > 2x rendered dimensions (only once loaded)
    if (img.naturalWidth > 0 && img.width > 0 && img.naturalWidth > 2 * img.width) {
      problems.push('oversized')
    }
    // Missing alt text — accessibility + SEO. An explicit empty alt="" is a
    // valid "decorative" signal, so only flag a truly absent attribute.
    if (!img.hasAttribute('alt')) {
      problems.push('missing-alt')
    }
    // Wrongly declared size: the width/height attributes describe a different
    // aspect ratio than the actual file, so the image renders stretched/squished.
    const wAttr = img.getAttribute('width')
    const hAttr = img.getAttribute('height')
    if (wAttr && hAttr && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const declared = Number(wAttr) / Number(hAttr)
      const natural = img.naturalWidth / img.naturalHeight
      if (declared > 0 && natural > 0 && Math.abs(declared - natural) / natural > ASPECT_TOLERANCE) {
        problems.push('distorted')
      }
    }

    if (problems.length === 0) return
    checkedSrcs.add(src)

    // missing-dimensions causes layout shift, so it drives error severity.
    const severity = problems.includes('missing-dimensions') ? 'error' : 'warning'
    const detail = problems.map((p) => PROBLEM_DESCRIPTIONS[p]).join('; ')

    issues = [
      ...issues,
      createIssue(
        'unoptimized-images',
        severity,
        `Image has ${problems.length} issue${problems.length > 1 ? 's' : ''}`,
        `Image "${src}" has: ${detail}.`,
        { src, problems },
      ),
    ]
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
