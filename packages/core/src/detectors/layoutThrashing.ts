import type { Detector, VibeIssue } from '../types.js'
import { hasLayoutShift } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_WINDOW_MS = 500
const CLUSTER_MIN_SHIFTS = 3

// ── Types ────────────────────────────────────────────────────────────────────

interface ShiftRecord {
  readonly timestamp: number
  readonly value: number
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createLayoutThrashingDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let observer: PerformanceObserver | null = null
  let recentShifts: ShiftRecord[] = []

  const processEntry = (entry: PerformanceEntry): void => {
    // Layout shift entries have hadRecentInput and value properties
    const shiftEntry = entry as PerformanceEntry & {
      readonly hadRecentInput: boolean
      readonly value: number
    }

    // Only count unexpected shifts (not caused by user input)
    if (shiftEntry.hadRecentInput) return

    const now = performance.now()
    const cutoff = now - CLUSTER_WINDOW_MS

    // In-place compaction: drop stale shifts, then append the new one.
    // No spread, no intermediate filter array.
    let write = 0
    for (let read = 0; read < recentShifts.length; read++) {
      const s = recentShifts[read]!
      if (s.timestamp >= cutoff) {
        if (write !== read) recentShifts[write] = s
        write += 1
      }
    }
    recentShifts.length = write
    recentShifts.push({ timestamp: now, value: shiftEntry.value })

    // Check for cluster
    if (recentShifts.length >= CLUSTER_MIN_SHIFTS) {
      let totalValue = 0
      for (let i = 0; i < recentShifts.length; i++) totalValue += recentShifts[i]!.value
      const clusterDuration = now - recentShifts[0]!.timestamp

      issues = [
        ...issues,
        createIssue(
          'layout-thrashing',
          'warning',
          `Layout shift cluster detected (${recentShifts.length} shifts)`,
          `${recentShifts.length} layout shifts occurred within ${Math.round(clusterDuration)}ms without user input. Total CLS value: ${totalValue.toFixed(4)}. This usually indicates DOM mutations causing cascading reflows.`,
          {
            shiftCount: recentShifts.length,
            totalShiftValue: Math.round(totalValue * 10000) / 10000,
            clusterDurationMs: Math.round(clusterDuration),
          },
        ),
      ]

      // Reset cluster tracking after reporting
      recentShifts = []
    }
  }

  return {
    name: 'layout-thrashing',

    start(): void {
      if (!hasLayoutShift()) return
      if (observer !== null) return

      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          processEntry(entry)
        }
      })

      observer.observe({ type: 'layout-shift', buffered: false })
    },

    stop(): void {
      if (observer !== null) {
        observer.disconnect()
        observer = null
      }
      recentShifts = []
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      recentShifts = []
    },
  }
}
