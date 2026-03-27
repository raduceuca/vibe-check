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

// ── Detector ─────────────────────────────────────────────────────────────────

export const createDomBloatDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let nodeTimerId: ReturnType<typeof setInterval> | null = null
  let depthTimerId: ReturnType<typeof setInterval> | null = null
  let lastThreshold: 'none' | 'warn' | 'error' = 'none'
  let lastMaxDepth = 0

  const checkNodeCount = (): void => {
    if (typeof document === 'undefined') return

    const nodeCount = document.querySelectorAll('*').length
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
          { nodeCount, maxDepth: lastMaxDepth, timestamp: Date.now() },
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
