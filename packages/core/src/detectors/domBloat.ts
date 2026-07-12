import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_POLL_MS = 5_000
const DEPTH_POLL_MS = 30_000
const WARN_NODE_THRESHOLD = 800
const ERROR_NODE_THRESHOLD = 1_500

// ── Helpers ──────────────────────────────────────────────────────────────────

const computeMaxDepth = (node: Node, depth: number): number => {
  let max = depth
  const children = node.childNodes
  for (let i = 0; i < children.length; i++) {
    const childDepth = computeMaxDepth(children[i], depth + 1)
    if (childDepth > max) max = childDepth
  }
  return max
}

// A short, queryable selector for an element — id when present, else a tag +
// :nth-of-type path bounded to a few levels.
const selectorFor = (el: Element): string => {
  if (el.id) return `#${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id}`
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body && node.parentElement && parts.length < 4) {
    let part = node.tagName.toLowerCase()
    const siblings = Array.from(node.parentElement.children).filter((c) => c.tagName === node!.tagName)
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
    parts.unshift(part)
    node = node.parentElement
  }
  return parts.join(' > ')
}

// The single top-level container holding the most elements — the bloat is almost
// always concentrated there, and scanning only body's direct children keeps this
// cheap (no per-element descendant counting).
const heaviestSubtreeSelector = (): string | undefined => {
  if (typeof document === 'undefined' || !document.body) return undefined
  let heaviest: Element | null = null
  let maxCount = 0
  for (const child of Array.from(document.body.children)) {
    const count = child.querySelectorAll('*').length
    if (count > maxCount) { maxCount = count; heaviest = child }
  }
  return heaviest ? selectorFor(heaviest) : undefined
}

// ── Detector ─────────────────────────────────────────────────────────────────

// The engine already samples `document.querySelectorAll('*').length` on its own
// interval for the snapshot. When it passes that sampler in, this detector reuses
// the cached count instead of running a second identical full-DOM scan, leaving
// only the periodic depth walk as its own work. Standalone (no getter) it falls
// back to scanning, so behavior is unchanged for direct consumers and tests.
export const createDomBloatDetector = (getDomNodeCount?: () => number): Detector => {
  let issues: VibeIssue[] = []
  let nodeTimerId: ReturnType<typeof setInterval> | null = null
  let depthTimerId: ReturnType<typeof setInterval> | null = null
  let lastThreshold: 'none' | 'warn' | 'error' = 'none'
  let lastMaxDepth = 0

  const readNodeCount = (): number =>
    getDomNodeCount ? getDomNodeCount() : document.querySelectorAll('*').length

  const checkNodeCount = (): void => {
    if (typeof document === 'undefined') return

    const nodeCount = readNodeCount()
    let threshold: 'none' | 'warn' | 'error' = 'none'

    if (nodeCount >= ERROR_NODE_THRESHOLD) {
      threshold = 'error'
    } else if (nodeCount >= WARN_NODE_THRESHOLD) {
      threshold = 'warn'
    }

    // Only create an issue on threshold crossing (don't spam)
    if (threshold !== 'none' && threshold !== lastThreshold) {
      const severity = threshold === 'error' ? 'error' : 'warning'
      issues = [
        ...issues,
        createIssue(
          'dom-bloat',
          severity,
          `DOM has ${nodeCount} nodes`,
          `The document contains ${nodeCount} DOM nodes, which exceeds the ${threshold === 'error' ? ERROR_NODE_THRESHOLD : WARN_NODE_THRESHOLD} threshold. Large DOMs slow down style calculations, layout, and memory usage.`,
          { nodeCount, maxDepth: lastMaxDepth, timestamp: Date.now(), selector: heaviestSubtreeSelector() },
        ),
      ]
    }

    lastThreshold = threshold
  }

  const checkMaxDepth = (): void => {
    if (typeof document === 'undefined') return
    lastMaxDepth = computeMaxDepth(document.documentElement, 0)
  }

  return {
    name: 'dom-bloat',

    start(): void {
      // Run initial checks immediately
      checkMaxDepth()
      checkNodeCount()

      nodeTimerId = setInterval(checkNodeCount, NODE_POLL_MS)
      depthTimerId = setInterval(checkMaxDepth, DEPTH_POLL_MS)
    },

    stop(): void {
      if (nodeTimerId !== null) {
        clearInterval(nodeTimerId)
        nodeTimerId = null
      }
      if (depthTimerId !== null) {
        clearInterval(depthTimerId)
        depthTimerId = null
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      lastThreshold = 'none'
    },
  }
}
