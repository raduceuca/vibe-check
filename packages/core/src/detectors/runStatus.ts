import { DETECTOR_KINDS } from '@wcgw/vibe-check-protocol'
import type { DetectorName, DetectorRunStatus } from '@wcgw/vibe-check-protocol'

// ── Detector run status (verification evidence) ──────────────────────────────
// A snapshot that omits an issue proves the issue is gone only when the
// detector has really looked since the moment in question. Each built-in
// detector reports that through getStatus(), built from one of these trackers.
//
// Two styles:
//   • live observers (event detectors: duplicate requests, layout shifts, long
//     frames, resources) watch the page all the time. They settle a fixed
//     window after observation starts, then every status reports evaluatedAt =
//     now, because nothing can happen without them seeing it.
//   • periodic checkers and audits settle on their first complete evaluation
//     and report the time of their latest one.

export interface RunTrackerOptions {
  /** Live observers only: settle this many ms after observation starts. */
  readonly settleAfterMs?: number
}

export interface RunTracker {
  /** start(): observation begins now. `supported: false` means this browser cannot observe (never settles). */
  readonly start: (now?: number, supported?: boolean) => void
  /** clear() / a fresh run: a new observation window that has not settled yet. */
  readonly reset: (now?: number) => void
  /** stop(): no longer observing. */
  readonly stop: () => void
  /** A complete evaluation finished at `at`. Settles the window on the first one. */
  readonly evaluated: (at?: number, inconclusiveChecks?: readonly string[]) => void
  readonly status: (now?: number) => DetectorRunStatus
  readonly isObserving: () => boolean
}

export const createRunTracker = (
  detector: DetectorName,
  options: RunTrackerOptions = {},
): RunTracker => {
  const kind = DETECTOR_KINDS[detector]
  const live = options.settleAfterMs !== undefined
  const settleAfterMs = options.settleAfterMs ?? 0
  let observingSince = Date.now()
  let settledAt: number | null = null
  let evaluatedAt: number | null = null
  let inconclusiveChecks: readonly string[] | undefined
  let observing = false
  let supported = true

  const reset = (now: number = Date.now()): void => {
    observingSince = now
    settledAt = null
    evaluatedAt = null
    inconclusiveChecks = undefined
  }

  return {
    start: (now = Date.now(), canObserve = true) => {
      reset(now)
      observing = true
      supported = canObserve
    },
    reset,
    stop: () => {
      observing = false
    },
    evaluated: (at = Date.now(), checks) => {
      if (!supported) return
      evaluatedAt = at
      if (settledAt === null) settledAt = at
      inconclusiveChecks = checks !== undefined && checks.length > 0 ? [...checks] : undefined
    },
    status: (now = Date.now()) => {
      if (live && observing && supported) {
        if (settledAt === null && now - observingSince >= settleAfterMs) {
          settledAt = observingSince + settleAfterMs
        }
        if (settledAt !== null) evaluatedAt = now
      }
      return {
        detector,
        kind,
        observingSince,
        settledAt: supported ? settledAt : null,
        evaluatedAt: supported ? evaluatedAt : null,
        ...(inconclusiveChecks !== undefined ? { inconclusiveChecks } : {}),
      }
    },
    isObserving: () => observing,
  }
}

// ── Clock helpers ────────────────────────────────────────────────────────────

/**
 * Epoch ms of a PerformanceEntry time (ms since timeOrigin), never in the
 * future. Used so issues carry when the condition really happened: a resource
 * loaded or a shift occurred before a verification request stays "before",
 * even when the detector first reports it later (after a recheck).
 */
export const epochOfEntryTime = (entryTimeMs: number, now: number = Date.now()): number => {
  if (typeof performance === 'undefined' || !Number.isFinite(entryTimeMs)) return now
  const origin = typeof performance.timeOrigin === 'number' && performance.timeOrigin > 0
    ? performance.timeOrigin
    : now - performance.now()
  const epoch = Math.round(origin + entryTimeMs)
  return Number.isFinite(epoch) ? Math.min(epoch, now) : now
}
