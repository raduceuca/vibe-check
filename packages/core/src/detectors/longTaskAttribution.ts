import type { Detector, VibeIssue } from '../types.js'
import { hasLongAnimationFrame } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const LONG_FRAME_THRESHOLD = 3

// ── Types ────────────────────────────────────────────────────────────────────

interface ScriptStats {
  readonly longFrameCount: number
  readonly totalBlockingMs: number
}

// Chrome LoAF entry shape
interface LoAFEntry extends PerformanceEntry {
  readonly scripts: readonly {
    readonly sourceURL: string
    readonly duration: number
  }[]
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createLongTaskAttributionDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let observer: PerformanceObserver | null = null
  const scriptMap = new Map<string, ScriptStats>()
  const reportedScripts = new Set<string>()

  const processEntry = (entry: PerformanceEntry): void => {
    const loaf = entry as LoAFEntry
    if (!loaf.scripts || loaf.scripts.length === 0) return

    for (const script of loaf.scripts) {
      const url = script.sourceURL
      if (!url) continue

      const existing = scriptMap.get(url)
      const stats: ScriptStats = existing
        ? {
            longFrameCount: existing.longFrameCount + 1,
            totalBlockingMs: existing.totalBlockingMs + script.duration,
          }
        : {
            longFrameCount: 1,
            totalBlockingMs: script.duration,
          }

      scriptMap.set(url, stats)

      if (stats.longFrameCount > LONG_FRAME_THRESHOLD && !reportedScripts.has(url)) {
        reportedScripts.add(url)

        issues = [
          ...issues,
          createIssue(
            'long-task-attribution',
            'warning',
            `Script causing long frames: ${url.split('/').pop() ?? url}`,
            `${url} has caused ${stats.longFrameCount} long animation frames with ${Math.round(stats.totalBlockingMs)}ms total blocking time. Consider code-splitting, deferring, or optimizing this script.`,
            {
              sourceURL: url,
              longFrameCount: stats.longFrameCount,
              totalBlockingMs: Math.round(stats.totalBlockingMs),
            },
          ),
        ]
      }
    }
  }

  return {
    name: 'long-task-attribution',

    start(): void {
      if (!hasLongAnimationFrame()) return
      if (observer !== null) return

      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          processEntry(entry)
        }
      })

      observer.observe({ type: 'long-animation-frame', buffered: false })
    },

    stop(): void {
      if (observer !== null) {
        observer.disconnect()
        observer = null
      }
      scriptMap.clear()
      reportedScripts.clear()
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      scriptMap.clear()
      reportedScripts.clear()
    },
  }
}
