import { issueLastSeenAt } from '@wcgw/vibe-check-protocol'
import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { hasLongAnimationFrame } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker, epochOfEntryTime } from './runStatus.js'

// ── Constants ────────────────────────────────────────────────────────────────

// A script is reported once it caused MORE than this many long animation
// frames (so 4+) within the retention window.
const LONG_FRAME_THRESHOLD = 3
// Frames older than this no longer count, and the issue is dropped once the
// script has not caused a long frame for this long.
const RETENTION_MS = 60_000
// With buffered entries, frames from before start() arrive in the first callback.
const SETTLE_MS = 1_000
const MAX_FRAMES_PER_SCRIPT = 50

// ── Types ────────────────────────────────────────────────────────────────────

interface FrameHit {
  readonly at: number
  readonly blockingMs: number
}

// Chrome LoAF entry shape
interface LoAFEntry extends PerformanceEntry {
  readonly scripts?: readonly {
    readonly sourceURL?: string
    readonly duration?: number
  }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Cache-busting and HMR queries (?v=hash, ?t=timestamp) and fragments are not
// part of the script's identity: the same module must keep one issue across
// hot updates.
export const stripScriptQuery = (url: string): string => url.split(/[?#]/, 1)[0] ?? url

const scriptName = (url: string): string => {
  const last = url.split('/').pop()
  return last !== undefined && last.length > 0 ? last : url
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createLongTaskAttributionDetector = (): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('long-task-attribution', { settleAfterMs: SETTLE_MS })
  let observer: PerformanceObserver | null = null
  const hitsByScript = new Map<string, FrameHit[]>()

  const recordHit = (url: string, hit: FrameHit, now: number): void => {
    const cutoff = now - RETENTION_MS
    const previous = hitsByScript.get(url) ?? []
    const hits = [...previous.filter((h) => h.at >= cutoff), hit].slice(-MAX_FRAMES_PER_SCRIPT)
    hitsByScript.set(url, hits)

    if (hits.length <= LONG_FRAME_THRESHOLD || hit.at < cutoff) return
    const totalBlockingMs = Math.round(hits.reduce((sum, h) => sum + h.blockingMs, 0))
    book.report(createIssue(
      'long-task-attribution',
      'warning',
      `Script causing long frames: ${scriptName(url)}`,
      `${url} caused ${hits.length} long animation frames with ${totalBlockingMs}ms of script time in the last ${RETENTION_MS / 1000}s. Consider code-splitting, deferring, or optimizing this script.`,
      {
        sourceURL: url,
        longFrameCount: hits.length,
        totalBlockingMs,
      },
      hit.at,
    ))
  }

  const processEntry = (entry: PerformanceEntry, now: number): void => {
    const loaf = entry as LoAFEntry
    if (!loaf.scripts || loaf.scripts.length === 0) return

    // One long frame counts once per script URL, however many of its
    // functions ran in that frame.
    const perScript = new Map<string, number>()
    for (const script of loaf.scripts) {
      const raw = script.sourceURL
      if (!raw) continue
      const url = stripScriptQuery(raw)
      perScript.set(url, (perScript.get(url) ?? 0) + (typeof script.duration === 'number' ? script.duration : 0))
    }
    const at = epochOfEntryTime(loaf.startTime + loaf.duration, now)
    for (const [url, blockingMs] of perScript) recordHit(url, { at, blockingMs }, now)
  }

  return {
    name: 'long-task-attribution',

    start(): void {
      if (observer !== null) return
      const supported = hasLongAnimationFrame()
      tracker.start(Date.now(), supported)
      if (!supported) return

      try {
        observer = new PerformanceObserver((list) => {
          const now = Date.now()
          for (const entry of list.getEntries()) {
            processEntry(entry, now)
          }
        })
        observer.observe({ type: 'long-animation-frame', buffered: true })
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
      hitsByScript.clear()
      tracker.stop()
    },

    getIssues(): readonly VibeIssue[] {
      const cutoff = Date.now() - RETENTION_MS
      book.retractWhere((issue) => issueLastSeenAt(issue) < cutoff)
      return book.list()
    },

    clear(): void {
      book.clear()
      hitsByScript.clear()
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
