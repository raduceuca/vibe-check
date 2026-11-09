import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { hasPerformanceMemory } from '../utils/featureDetect.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker } from './runStatus.js'

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS = 5_000
// Samples from the page's first 30 s are boot, not steady state: the heap
// always grows while an app loads.
const WARMUP_MS = 30_000
// The heap is judged over this window, split into equal slices. A leak is a
// floor that keeps rising: the lowest reading of each slice (the closest thing
// to a post-GC heap) climbs slice after slice. A GC sawtooth or a heap that grew
// during boot and then levelled off does not.
const WINDOW_MS = 120_000
const SLICE_COUNT = 4
const MIN_SAMPLES_PER_SLICE = 2
const WARN_GROWTH_PCT = 10
const ERROR_GROWTH_PCT = 25
// Floors this close count as flat (quantized heap readings), and a leak must
// add at least this much memory, so tiny heaps cannot trip the percentage alone.
const FLAT_TOLERANCE_PCT = 0.5
const MIN_GROWTH_MB = 1
const MIN_RISING_STEPS = 2

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

interface FloorTrend {
  readonly floors: readonly number[]
  readonly growthPct: number
  readonly growthMB: number
  readonly rising: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const pageAgeMs = (now: number): number => {
  if (typeof performance === 'undefined') return Number.POSITIVE_INFINITY
  const origin = typeof performance.timeOrigin === 'number' && performance.timeOrigin > 0
    ? performance.timeOrigin
    : now - performance.now()
  return now - origin
}

/** Lowest reading per slice of the window, or null until every slice has enough samples. */
const sliceFloors = (samples: readonly HeapSample[], windowStart: number): number[] | null => {
  const sliceMs = WINDOW_MS / SLICE_COUNT
  const floors: number[] = Array.from({ length: SLICE_COUNT }, () => Number.POSITIVE_INFINITY)
  const counts: number[] = Array.from({ length: SLICE_COUNT }, () => 0)
  for (const sample of samples) {
    const index = Math.min(SLICE_COUNT - 1, Math.floor((sample.timestamp - windowStart) / sliceMs))
    if (index < 0) continue
    counts[index] = (counts[index] ?? 0) + 1
    floors[index] = Math.min(floors[index] ?? Number.POSITIVE_INFINITY, sample.usedHeapMB)
  }
  return counts.every((count) => count >= MIN_SAMPLES_PER_SLICE) ? floors : null
}

export const analyzeHeapFloors = (floors: readonly number[]): FloorTrend => {
  const first = floors[0] ?? 0
  const last = floors[floors.length - 1] ?? 0
  const tolerance = first * (FLAT_TOLERANCE_PCT / 100)
  let risingSteps = 0
  let neverFalls = true
  for (let i = 1; i < floors.length; i++) {
    const step = floors[i]! - floors[i - 1]!
    if (step > tolerance) risingSteps += 1
    if (step < -tolerance) neverFalls = false
  }
  const growthMB = last - first
  const growthPct = first > 0 ? (growthMB / first) * 100 : 0
  return {
    floors,
    growthPct,
    growthMB,
    rising: neverFalls && risingSteps >= MIN_RISING_STEPS && growthMB >= MIN_GROWTH_MB && growthPct >= WARN_GROWTH_PCT,
  }
}

// ── Detector ─────────────────────────────────────────────────────────────────

// A state detector: once the first full window after warm-up is available it
// settles, and every later sample re-judges the latest window. A rising floor
// refreshes the open issue; a floor that stops rising retracts it.
export const createMemoryLeakDetector = (): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('memory-leak')
  let samples: HeapSample[] = []
  let timerId: ReturnType<typeof setInterval> | null = null

  const getUsedHeapMB = (): number | null => {
    if (!hasPerformanceMemory()) return null
    const memory = (performance as unknown as { memory: PerformanceMemory }).memory
    return memory.usedJSHeapSize / (1024 * 1024)
  }

  const analyze = (now: number): void => {
    const windowStart = now - WINDOW_MS
    const floors = sliceFloors(samples, windowStart)
    if (floors === null) return

    const trend = analyzeHeapFloors(floors)
    tracker.evaluated(now)
    if (!trend.rising) {
      book.clear()
      return
    }

    const baseline = floors[0]!
    const current = floors[floors.length - 1]!
    const pct = Math.round(trend.growthPct)
    const sliceSeconds = WINDOW_MS / SLICE_COUNT / 1000
    book.report(createIssue(
      'memory-leak',
      trend.growthPct >= ERROR_GROWTH_PCT ? 'error' : 'warning',
      `Potential memory leak (${pct}% growth)`,
      `The lowest heap reading rose in every ${sliceSeconds}s slice of the last ${WINDOW_MS / 1000}s: ${baseline.toFixed(1)}MB → ${current.toFixed(1)}MB (+${pct}%). Memory that does not come back down after garbage collection usually means something keeps references alive: detached DOM nodes, listeners or timers without cleanup, or data structures that only grow.`,
      {
        heapGrowthPct: Math.round(trend.growthPct * 10) / 10,
        baselineMB: Math.round(baseline * 10) / 10,
        currentMB: Math.round(current * 10) / 10,
        sampleCount: samples.length,
      },
      now,
    ))
  }

  const takeSample = (): void => {
    const heapMB = getUsedHeapMB()
    if (heapMB === null) return

    const now = Date.now()
    if (pageAgeMs(now) < WARMUP_MS) return

    // Add the new sample and keep only the window (immutable rebuild)
    const cutoff = now - WINDOW_MS
    samples = [...samples.filter((s) => s.timestamp >= cutoff), { timestamp: now, usedHeapMB: heapMB }]
    analyze(now)
  }

  return {
    name: 'memory-leak',

    start(): void {
      if (timerId !== null) return
      const supported = hasPerformanceMemory()
      tracker.start(Date.now(), supported)
      if (!supported) return
      takeSample()
      timerId = setInterval(takeSample, SAMPLE_INTERVAL_MS)
    },

    stop(): void {
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
      samples = []
      tracker.stop()
    },

    getIssues(): readonly VibeIssue[] {
      return book.list()
    },

    clear(): void {
      book.clear()
      samples = []
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
