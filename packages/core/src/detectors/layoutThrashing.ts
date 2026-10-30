import { issueLastSeenAt } from '@wcgw/vibe-check-protocol'
import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { hasLayoutShift } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker, epochOfEntryTime } from './runStatus.js'

// The detector name stays 'layout-thrashing' (protocol), but what it measures is
// layout SHIFTS: content moving after it was painted (the CLS signal), not
// forced synchronous reflows. Its copy and suggestions say so.

// ── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_WINDOW_MS = 500
const CLUSTER_MIN_SHIFTS = 3
// The issue is dropped once no new cluster has happened for this long.
const RETENTION_MS = 60_000
// With buffered entries, shifts from before start() arrive in the first
// callback; after this short observation the detector has seen them.
const SETTLE_MS = 1_000
const MAX_SOURCES = 3
const WIDGET_SELECTOR = '[data-wcgw]'

// ── Types ────────────────────────────────────────────────────────────────────

interface ShiftSource {
  readonly node?: Node | null
}

interface ShiftRecord {
  readonly startTime: number
  readonly value: number
  readonly sources: readonly ShiftSource[]
}

type LayoutShiftEntry = PerformanceEntry & {
  readonly hadRecentInput?: boolean
  readonly value?: number
  readonly sources?: readonly ShiftSource[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const describeNode = (node: Node | null | undefined): string | null => {
  if (!node || node.nodeType !== 1) return null
  const el = node as Element
  if (el.closest(WIDGET_SELECTOR)) return null
  const tag = el.tagName.toLowerCase()
  if (el.id) return `${tag}#${el.id}`
  const firstClass = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
  return firstClass ? `${tag}.${firstClass}` : tag
}

const shiftedElements = (shifts: readonly ShiftRecord[]): readonly string[] => {
  const names: string[] = []
  for (const shift of shifts) {
    for (const source of shift.sources) {
      const name = describeNode(source.node)
      if (name !== null && !names.includes(name)) names.push(name)
      if (names.length >= MAX_SOURCES) return names
    }
  }
  return names
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createLayoutThrashingDetector = (): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('layout-thrashing', { settleAfterMs: SETTLE_MS })
  let observer: PerformanceObserver | null = null
  let recentShifts: ShiftRecord[] = []

  const reportCluster = (cluster: readonly ShiftRecord[]): void => {
    const now = Date.now()
    const first = cluster[0]!
    const last = cluster[cluster.length - 1]!
    const observedAt = epochOfEntryTime(last.startTime, now)
    // A re-delivered buffered cluster that is already past retention stays gone.
    if (observedAt < now - RETENTION_MS) return

    let totalValue = 0
    for (const shift of cluster) totalValue += shift.value
    const clusterDuration = Math.max(0, last.startTime - first.startTime)
    const elements = shiftedElements(cluster)

    book.report(createIssue(
      'layout-thrashing',
      'warning',
      `Layout shifted ${cluster.length} times without user input`,
      `${cluster.length} layout shifts happened within ${Math.round(clusterDuration)}ms with no user input (shift score ${totalValue.toFixed(4)}). Content moved after it was painted.${elements.length > 0 ? ` Elements that moved: ${elements.join(', ')}.` : ''} Usual causes: images or embeds without reserved space, content inserted above what is already shown (banners, late data), web fonts swapping in, or animating height/top instead of transform.`,
      {
        shiftCount: cluster.length,
        totalShiftValue: Math.round(totalValue * 10000) / 10000,
        clusterDurationMs: Math.round(clusterDuration),
      },
      observedAt,
    ))
  }

  // Clusters use each shift's own startTime, so shifts seconds apart that the
  // browser delivers in one batch are not mistaken for a burst.
  const processEntries = (entries: readonly PerformanceEntry[]): void => {
    const shifts = (entries as readonly LayoutShiftEntry[])
      .filter((entry) => entry.hadRecentInput !== true)
      .map((entry): ShiftRecord => ({
        startTime: entry.startTime,
        value: typeof entry.value === 'number' ? entry.value : 0,
        sources: Array.isArray(entry.sources) ? entry.sources : [],
      }))
      .sort((a, b) => a.startTime - b.startTime)

    for (const shift of shifts) {
      const cutoff = shift.startTime - CLUSTER_WINDOW_MS
      recentShifts = recentShifts.filter((s) => s.startTime >= cutoff && s.startTime <= shift.startTime)
      recentShifts.push(shift)
      if (recentShifts.length >= CLUSTER_MIN_SHIFTS) {
        reportCluster(recentShifts)
        // Start a new cluster after reporting.
        recentShifts = []
      }
    }
  }

  return {
    name: 'layout-thrashing',

    start(): void {
      if (observer !== null) return
      const supported = hasLayoutShift()
      tracker.start(Date.now(), supported)
      if (!supported) return

      try {
        observer = new PerformanceObserver((list) => {
          processEntries(list.getEntries())
        })
        observer.observe({ type: 'layout-shift', buffered: true })
      } catch {
        observer?.disconnect()
        observer = null
        tracker.start(Date.now(), false)
      }
    },

    stop(): void {
      if (observer !== null) {
        observer.disconnect()
        observer = null
      }
      recentShifts = []
      tracker.stop()
    },

    getIssues(): readonly VibeIssue[] {
      const cutoff = Date.now() - RETENTION_MS
      book.retractWhere((issue) => issueLastSeenAt(issue) < cutoff)
      return book.list()
    },

    clear(): void {
      book.clear()
      recentShifts = []
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
