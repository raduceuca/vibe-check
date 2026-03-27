import type { Detector, VibeIssue } from '../types.js'
import { hasPerformanceMemory } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS = 5_000
const WINDOW_MS = 30_000
const WARN_GROWTH_PCT = 10
const ERROR_GROWTH_PCT = 25
const RECOVERY_THRESHOLD_PCT = 5

// ── Types ────────────────────────────────────────────────────────────────────

interface HeapSample {
  readonly timestamp: number
  readonly usedHeapMB: number
}

// Chrome-specific memory interface
interface PerformanceMemory {
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createMemoryLeakDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let samples: HeapSample[] = []
  let timerId: ReturnType<typeof setInterval> | null = null
  let lastReportedSeverity: 'none' | 'warning' | 'error' = 'none'

  const getUsedHeapMB = (): number | null => {
    if (!hasPerformanceMemory()) return null
    const memory = (performance as unknown as { memory: PerformanceMemory }).memory
    return memory.usedJSHeapSize / (1024 * 1024)
  }

  const takeSample = (): void => {
    const heapMB = getUsedHeapMB()
    if (heapMB === null) return

    const now = Date.now()
    const cutoff = now - WINDOW_MS

    // Add new sample and trim to window (immutable rebuild)
    samples = [...samples.filter((s) => s.timestamp >= cutoff), { timestamp: now, usedHeapMB: heapMB }]

    analyze()
  }

  const analyze = (): void => {
    // Need at least 4 samples (20s of data) to make a meaningful assessment
    if (samples.length < 4) return

    const baseline = samples[0].usedHeapMB
    const current = samples[samples.length - 1].usedHeapMB

    if (baseline <= 0) return

    const growthPct = ((current - baseline) / baseline) * 100

    // Check if any sample in the SECOND HALF of the window dipped below baseline + recovery threshold
    // Early samples naturally start near baseline, so only check later ones for GC recovery
    const recoveryLine = baseline * (1 + RECOVERY_THRESHOLD_PCT / 100)
    const secondHalf = samples.slice(Math.floor(samples.length / 2))
    const hadRecovery = secondHalf.some((s) => s.usedHeapMB < recoveryLine)

    if (hadRecovery || growthPct < WARN_GROWTH_PCT) {
      // Reset tracking if growth reversed
      if (growthPct < WARN_GROWTH_PCT) {
        lastReportedSeverity = 'none'
      }
      return
    }

    let severity: 'warning' | 'error'
    if (growthPct >= ERROR_GROWTH_PCT) {
      severity = 'error'
    } else {
      severity = 'warning'
    }

    // Don't re-report same severity
    if (severity === lastReportedSeverity) return
    // Don't downgrade from error to warning
    if (lastReportedSeverity === 'error' && severity === 'warning') return

    lastReportedSeverity = severity

    issues = [
      ...issues,
      createIssue(
        'memory-leak',
        severity,
        `Potential memory leak (${Math.round(growthPct)}% growth)`,
        `Heap grew from ${baseline.toFixed(1)}MB to ${current.toFixed(1)}MB (${Math.round(growthPct)}%) over ${WINDOW_MS / 1000}s without GC recovery. This may indicate a memory leak from detached DOM nodes, accumulating closures, or growing data structures.`,
        {
          heapGrowthPct: Math.round(growthPct * 10) / 10,
          baselineMB: Math.round(baseline * 10) / 10,
          currentMB: Math.round(current * 10) / 10,
          sampleCount: samples.length,
        },
      ),
    ]
  }

  return {
    name: 'memory-leak',

    start(): void {
      if (!hasPerformanceMemory()) return
      takeSample()
      timerId = setInterval(takeSample, SAMPLE_INTERVAL_MS)
    },

    stop(): void {
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
      samples = []
      lastReportedSeverity = 'none'
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      samples = []
      lastReportedSeverity = 'none'
    },
  }
}
