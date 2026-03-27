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
    const record: ShiftRecord = {
      timestamp: now,
      value: shiftEntry.value,
    }

    // Add to recent shifts and trim old ones
    recentShifts = [
      ...recentShifts.filter((s) => now - s.timestamp < CLUSTER_WINDOW_MS),
      record,
    ]

    // Check for cluster
    if (recentShifts.length >= CLUSTER_MIN_SHIFTS) {
      const totalValue = recentShifts.reduce((sum, s) => sum + s.value, 0)
      const clusterDuration = now - recentShifts[0].timestamp

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
