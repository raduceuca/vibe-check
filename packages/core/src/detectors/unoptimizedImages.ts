import type { Detector, VibeIssue, Severity } from '../types.js'
import { hasMutationObserver } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Types ────────────────────────────────────────────────────────────────────

type ImageIssueType = 'missing-lazy' | 'missing-dimensions' | 'oversized' | 'missing-alt' | 'distorted'

// Declared vs natural aspect ratios diverging beyond this fraction read as
// stretched/squished — a wrongly declared size.
const ASPECT_TOLERANCE = 0.15

// Bound the "already folded in" set so a long-lived SPA that swaps thousands of
// images over a session can't grow it without limit.
const MAX_TRACKED_SRCS = 500

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

const PROBLEM_DESCRIPTIONS: Record<ImageIssueType, string> = {
  'missing-lazy': 'missing loading="lazy" (below the fold, so it blocks the critical render path)',
  'missing-dimensions': 'missing width/height attributes (causes layout shift / CLS)',
  'oversized': 'natural size much larger than its rendered size (wastes bandwidth)',
  'missing-alt': 'no alt text (screen readers and search engines can\'t describe it)',
  'distorted': 'declared width/height don\'t match the file\'s real aspect ratio (it\'s stretched or squished)',
}

// Short headline phrase per problem for the issue title.
const PROBLEM_HEADLINE: Record<ImageIssueType, string> = {
  'missing-dimensions': 'missing width/height',
  'oversized': 'oversized for its display size',
  'distorted': 'stretched or squished',
  'missing-lazy': 'not lazy-loaded',
  'missing-alt': 'missing alt text',
}

// Worst-first — the headline problem shown in the title.
const PROBLEM_PRIORITY: readonly ImageIssueType[] = [
  'missing-dimensions', 'oversized', 'distorted', 'missing-lazy', 'missing-alt',
]

const primaryProblem = (problems: readonly ImageIssueType[]): ImageIssueType =>
  PROBLEM_PRIORITY.find((p) => problems.includes(p)) ?? problems[0]!

// A URL's last path segment is a filename only when it has a short extension
// (hero.png). CDN/placeholder URLs (picsum.photos/2400/1200) have none — return
// null so titles fall back to dimensions instead of surfacing "2400/1200".
const imageFilenameOf = (src: string): string | null => {
  const last = src.split('?')[0].split('#')[0].split('/').pop() ?? ''
  return /\.[a-z0-9]{2,5}$/i.test(last) ? last : null
}

// "hero.png (2400×1200)" when a filename exists, else "2400×1200 image", else
// "Image" — never a bare numeric path.
const imageTitleBase = (src: string, w: number, h: number): string => {
  const file = imageFilenameOf(src)
  const dims = w > 0 && h > 0 ? `${w}×${h}` : ''
  if (file) return dims ? `${file} (${dims})` : file
  return dims ? `${dims} image` : 'Image'
}

const buildTitle = (
  src: string, w: number, h: number, problems: readonly ImageIssueType[], count: number,
): string => {
  const headline = PROBLEM_HEADLINE[primaryProblem(problems)]
  return `${imageTitleBase(src, w, h)} ${headline}${count > 1 ? ` (×${count})` : ''}`
}

const buildDescription = (
  src: string, problems: readonly ImageIssueType[], count: number,
): string => {
  const detail = problems.map((p) => PROBLEM_DESCRIPTIONS[p]).join('; ')
  return count > 1
    ? `${count} images share these problems: ${detail}. Representative: "${src}".`
    : `Image "${src}" has: ${detail}.`
}

// missing-dimensions causes layout shift, so it drives error severity.
const severityFor = (problems: readonly ImageIssueType[]): Severity =>
  problems.includes('missing-dimensions') ? 'error' : 'warning'

// ── Detector ─────────────────────────────────────────────────────────────────

export const createUnoptimizedImagesDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let observer: MutationObserver | null = null
  // Images sharing the same problem signature collapse into ONE issue carrying a
  // ×N count, so a grid of identically-broken thumbnails is a single row, not N.
  const indexBySignature = new Map<string, number>()
  // Srcs already folded into a group, so re-observing the same node doesn't
  // double-count. Bounded to MAX_TRACKED_SRCS.
  const countedSrcs = new Set<string>()

  const trackSrc = (src: string): void => {
    countedSrcs.add(src)
    if (countedSrcs.size > MAX_TRACKED_SRCS) {
      const oldest = countedSrcs.values().next().value
      if (oldest !== undefined) countedSrcs.delete(oldest)
    }
  }

  const checkImage = (img: HTMLImageElement): void => {
    const src = truncateSrc(img.src || img.getAttribute('src') || 'unknown')
    if (countedSrcs.has(src)) return

    const problems: ImageIssueType[] = []

    if (img.getAttribute('loading') !== 'lazy' && isBelowFold(img)) {
      problems.push('missing-lazy')
    }
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      problems.push('missing-dimensions')
    }
    if (img.naturalWidth > 0 && img.width > 0 && img.naturalWidth > 2 * img.width) {
      problems.push('oversized')
    }
    // An explicit empty alt="" is a valid "decorative" signal, so only flag a
    // truly absent attribute.
    if (!img.hasAttribute('alt')) {
      problems.push('missing-alt')
    }
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
    trackSrc(src)

    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    const renderedWidth = img.width || img.clientWidth
    const renderedHeight = img.height || img.clientHeight
    const signature = [...problems].sort().join('|')
    const existingIdx = indexBySignature.get(signature)

    if (existingIdx === undefined) {
      const issue = createIssue(
        'unoptimized-images',
        severityFor(problems),
        buildTitle(src, naturalWidth, naturalHeight, problems, 1),
        buildDescription(src, problems, 1),
        { src, problems, count: 1, naturalWidth, naturalHeight, renderedWidth, renderedHeight },
      )
      indexBySignature.set(signature, issues.length)
      issues = [...issues, issue]
      return
    }

    // Fold this repeat offender into the existing group: bump the count and
    // re-title, keeping the representative image's id, src, and dimensions.
    const prev = issues[existingIdx]!
    const prevCount = typeof prev.evidence['count'] === 'number' ? (prev.evidence['count'] as number) : 1
    const count = prevCount + 1
    const repSrc = typeof prev.evidence['src'] === 'string' ? (prev.evidence['src'] as string) : src
    const repW = typeof prev.evidence['naturalWidth'] === 'number' ? (prev.evidence['naturalWidth'] as number) : naturalWidth
    const repH = typeof prev.evidence['naturalHeight'] === 'number' ? (prev.evidence['naturalHeight'] as number) : naturalHeight
    const updated: VibeIssue = {
      ...prev,
      title: buildTitle(repSrc, repW, repH, problems, count),
      description: buildDescription(repSrc, problems, count),
      evidence: { ...prev.evidence, count },
    }
    issues = issues.map((it, i) => (i === existingIdx ? updated : it))
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
      countedSrcs.clear()
      indexBySignature.clear()
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      countedSrcs.clear()
      indexBySignature.clear()
    },
  }
}
