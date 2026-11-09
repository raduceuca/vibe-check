import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker } from './runStatus.js'

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_POLL_MS = 5_000
const DEPTH_POLL_MS = 30_000
const WARN_NODE_THRESHOLD = 800
const ERROR_NODE_THRESHOLD = 1_500

// Elements VibeCheck itself renders (pill, panel, annotation layer, portals)
// sit under an element carrying this attribute; they are not the page's DOM.
const WIDGET_ATTRIBUTE = 'data-wcgw'

// ── Helpers ──────────────────────────────────────────────────────────────────

const isWidgetRoot = (node: Node): boolean =>
  node.nodeType === 1 && (node as Element).hasAttribute(WIDGET_ATTRIBUTE)

const computeMaxDepth = (node: Node, depth: number): number => {
  let max = depth
  const children = node.childNodes
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!
    if (isWidgetRoot(child)) continue
    const childDepth = computeMaxDepth(child, depth + 1)
    if (childDepth > max) max = childDepth
  }
  return max
}

// Standalone fallback (no engine sampler): every element except the widget's
// own subtrees, roots included.
const countPageElements = (): number => {
  const total = document.querySelectorAll('*').length
  let widget = 0
  for (const root of Array.from(document.querySelectorAll(`[${WIDGET_ATTRIBUTE}]`))) {
    if (!(root instanceof Element)) continue
    // Nested roots are already counted by their outer root.
    if (root.parentElement?.closest(`[${WIDGET_ATTRIBUTE}]`)) continue
    widget += root.querySelectorAll('*').length + 1
  }
  return Math.max(0, total - widget)
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
// cheap (no per-element descendant counting). The widget's own root is skipped.
const heaviestSubtreeSelector = (): string | undefined => {
  if (typeof document === 'undefined' || !document.body) return undefined
  let heaviest: Element | null = null
  let maxCount = 0
  for (const child of Array.from(document.body.children)) {
    if (child.hasAttribute(WIDGET_ATTRIBUTE)) continue
    const count = child.querySelectorAll('*').length
    if (count > maxCount) { maxCount = count; heaviest = child }
  }
  return heaviest ? selectorFor(heaviest) : undefined
}

// ── Detector ─────────────────────────────────────────────────────────────────

// The engine already samples the page's element count (widget excluded) on its
// own interval for the snapshot. When it passes that sampler in, this detector
// reuses the cached count instead of running a second identical full-DOM scan,
// leaving only the periodic depth walk as its own work. Standalone (no getter)
// it falls back to scanning, so behavior is unchanged for direct consumers.
//
// A state detector: every check that still sees too many nodes refreshes the
// open issue (same id, new lastSeenAt), and a check below the threshold
// retracts it.
export const createDomBloatDetector = (getDomNodeCount?: () => number): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('dom-bloat')
  let nodeTimerId: ReturnType<typeof setInterval> | null = null
  let depthTimerId: ReturnType<typeof setInterval> | null = null
  let lastMaxDepth = 0

  const readNodeCount = (): number =>
    getDomNodeCount ? getDomNodeCount() : countPageElements()

  const checkNodeCount = (): void => {
    if (typeof document === 'undefined') return

    const now = Date.now()
    const nodeCount = readNodeCount()
    const threshold: 'none' | 'warn' | 'error' = nodeCount >= ERROR_NODE_THRESHOLD
      ? 'error'
      : nodeCount >= WARN_NODE_THRESHOLD ? 'warn' : 'none'

    if (threshold === 'none') {
      book.clear()
    } else {
      const severity = threshold === 'error' ? 'error' : 'warning'
      book.report(createIssue(
        'dom-bloat',
        severity,
        `DOM has ${nodeCount} nodes`,
        `The document contains ${nodeCount} DOM nodes, which exceeds the ${threshold === 'error' ? ERROR_NODE_THRESHOLD : WARN_NODE_THRESHOLD} threshold. Large DOMs slow down style calculations, layout, and memory usage.`,
        { nodeCount, maxDepth: lastMaxDepth, timestamp: now, selector: heaviestSubtreeSelector() },
        now,
      ))
    }
    tracker.evaluated(now)
  }

  const checkMaxDepth = (): void => {
    if (typeof document === 'undefined' || !document.documentElement) return
    lastMaxDepth = computeMaxDepth(document.documentElement, 0)
  }

  return {
    name: 'dom-bloat',

    start(): void {
      if (nodeTimerId !== null) return
      tracker.start(Date.now(), typeof document !== 'undefined')
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
      tracker.stop()
    },

    getIssues(): readonly VibeIssue[] {
      return book.list()
    },

    clear(): void {
      book.clear()
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
