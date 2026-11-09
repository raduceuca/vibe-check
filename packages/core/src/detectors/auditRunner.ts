import type { AuditDetectorName, AuditRun, DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, Severity, VibeIssue } from '../types.js'
import { createProbeCache, probeFetch } from '../utils/probe.js'
import type { AuditDetectorOptions, ProbeResult } from '../utils/probe.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker } from './runStatus.js'

// ── Shared audit lifecycle (seo, aeo, web-essentials) ────────────────────────
// One run = every synchronous DOM check, then every network probe. A run can be
// repeated: start() after stop(), clear() while running, or the engine's
// recheck() (SPA route change, verification) each start a fresh run, and a run
// that was superseded never writes into the new one. A probe that gets no
// response leaves its check "unreachable": the check keeps whatever state it
// had, is listed in getAuditRun().unreachable and in getStatus()
// .inconclusiveChecks, and so never counts as passing.

export interface AuditFinding {
  readonly check: string
  readonly severity: Severity
  readonly title: string
  readonly description: string
  readonly detail?: string
}

export type ProbeFn = (url: string, init?: RequestInit) => Promise<ProbeResult>

/** A probe check resolves to its finding (fail), 'pass', or 'unreachable'. */
export type ProbeOutcome = AuditFinding | 'pass' | 'unreachable'

export interface ProbeCheck {
  /** The check id this probe decides (evidence.check of its finding). */
  readonly check: string
  readonly run: (probe: ProbeFn) => Promise<ProbeOutcome>
}

export interface AuditRunnerConfig {
  readonly detector: AuditDetectorName
  /** Delay after window load before a run, so SPA <head> updates have landed. */
  readonly delayMs: number
  /** Synchronous checks: every failing check's finding. */
  readonly domChecks: () => readonly AuditFinding[]
  readonly probeChecks?: readonly ProbeCheck[]
  readonly options?: AuditDetectorOptions
}

export const createAuditDetector = (config: AuditRunnerConfig): Detector => {
  const { detector, delayMs } = config
  const probeChecks = config.probeChecks ?? []
  const probeCheckIds = new Set(probeChecks.map((p) => p.check))
  const book = createIssueBook()
  const tracker = createRunTracker(detector)

  let started = false
  let runToken = 0
  let lastRun: AuditRun | null = null
  let pendingChecks: readonly string[] = []
  let timerId: ReturnType<typeof setTimeout> | null = null
  let loadHandler: (() => void) | null = null

  const report = (finding: AuditFinding, at: number): void => {
    book.report(createIssue(
      detector,
      finding.severity,
      finding.title,
      finding.description,
      finding.detail !== undefined ? { check: finding.check, detail: finding.detail } : { check: finding.check },
      at,
    ))
  }

  const checkOf = (issue: VibeIssue): string => {
    const check = issue.evidence['check']
    return typeof check === 'string' ? check : ''
  }

  const finishRun = (run: AuditRun, failed: readonly string[], unreachable: readonly string[]): void => {
    const finishedAt = Date.now()
    lastRun = {
      ...run,
      status: unreachable.length > 0 ? 'incomplete' : 'complete',
      finishedAt,
      failedChecks: failed,
      unreachable,
    }
    pendingChecks = []
    tracker.evaluated(finishedAt, unreachable)
  }

  const run = (): void => {
    timerId = null
    if (!started || typeof document === 'undefined') return
    const token = ++runToken
    const startedAt = Date.now()
    const running: AuditRun = {
      detector,
      status: 'running',
      startedAt,
      failedChecks: [],
      unreachable: [],
    }
    lastRun = running

    // Synchronous DOM checks: report every failure, retract every DOM check
    // that passes now.
    const domFindings = config.domChecks()
    const domFailed = new Set(domFindings.map((f) => f.check))
    for (const finding of domFindings) report(finding, startedAt)
    book.retractWhere((issue) => {
      const check = checkOf(issue)
      return !probeCheckIds.has(check) && !domFailed.has(check)
    })

    if (probeChecks.length === 0) {
      finishRun(running, [...domFailed], [])
      return
    }

    lastRun = { ...running, failedChecks: [...domFailed] }
    pendingChecks = probeChecks.map((p) => p.check)
    const cache = config.options?.probeCache ?? createProbeCache()
    const probe: ProbeFn = (url, init) => probeFetch(url, init, cache)

    void Promise.all(probeChecks.map(async (p) => {
      try {
        return { check: p.check, outcome: await p.run(probe) }
      } catch {
        return { check: p.check, outcome: 'unreachable' as const }
      }
    })).then((results) => {
      if (token !== runToken || !started) return
      const at = Date.now()
      const failed = [...domFailed]
      const unreachable: string[] = []
      for (const { check, outcome } of results) {
        if (outcome === 'unreachable') {
          unreachable.push(check)
        } else if (outcome === 'pass') {
          book.retractWhere((issue) => checkOf(issue) === check)
        } else {
          failed.push(outcome.check)
          report(outcome, at)
        }
      }
      finishRun(running, failed, unreachable)
    })
  }

  const cancelScheduled = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    if (loadHandler !== null && typeof window !== 'undefined') {
      window.removeEventListener('load', loadHandler)
      loadHandler = null
    }
  }

  const schedule = (): void => {
    cancelScheduled()
    if (document.readyState === 'complete') {
      timerId = setTimeout(run, delayMs)
      return
    }
    loadHandler = () => {
      loadHandler = null
      timerId = setTimeout(run, delayMs)
    }
    window.addEventListener('load', loadHandler, { once: true })
  }

  // A run that has not finished when it is superseded or stopped is reported as
  // incomplete, with its unfinished probes listed as unreachable.
  const abandonRun = (): void => {
    runToken += 1
    if (lastRun !== null && lastRun.status === 'running') {
      lastRun = {
        ...lastRun,
        status: 'incomplete',
        finishedAt: Date.now(),
        unreachable: pendingChecks,
      }
    }
    pendingChecks = []
  }

  return {
    name: detector,

    start(): void {
      if (started || typeof document === 'undefined') return
      started = true
      tracker.start()
      schedule()
    },

    stop(): void {
      if (!started) {
        cancelScheduled()
        return
      }
      started = false
      cancelScheduled()
      abandonRun()
      tracker.stop()
    },

    getIssues(): readonly VibeIssue[] {
      return book.list()
    },

    clear(): void {
      book.clear()
      abandonRun()
      lastRun = null
      tracker.reset()
      // Still running: audit the page again so the detector settles again.
      if (started) schedule()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },

    getAuditRun(): AuditRun | null {
      return lastRun
    },
  }
}
