import type { FrameRateStats, Collector } from '../types.js'
import { EMPTY_FRAME_RATE_STATS } from '../types.js'
import { RingBuffer } from '../utils/ringBuffer.js'

// ── Constants ────────────────────────────────────────────────────────────────

// A frame counts as dropped when it took clearly longer than the display's own
// frame interval: more than 1.5x the estimated interval, i.e. at least one
// missed refresh. The interval is estimated from the frames themselves, so 30,
// 50, 60, 120 and 144 Hz displays all read as smooth when idle, and timer
// coarsening (Chrome 0.1 ms, Firefox 1 ms) cannot tip on-time frames over the
// line (C10).
const DROPPED_FRAME_FACTOR = 1.5
// rAF pauses in background tabs and throttles in occluded ones. A gap longer
// than this is a pause, not a frame (C22). Real long frames are still reported
// by the long-animation-frame collector.
const MAX_FRAME_GAP_MS = 1000
const SAMPLE_WINDOW_MS = 1000
const REPORT_INTERVAL_MS = 500
// The display interval is the smallest window median of the last 10 s (20
// reports), so a few seconds of heavy jank are still measured against the
// real refresh rate instead of redefining it.
const INTERVAL_HISTORY_REPORTS = 20
const MIN_SAMPLES_FOR_INTERVAL = 10

// Conservative max: at 240fps over 1s, 240 samples + headroom
const DEFAULT_BUFFER_CAPACITY = 300

// ── Types ────────────────────────────────────────────────────────────────────

interface FrameSample {
  readonly timestamp: number
  readonly duration: number
}

// ── Pure stat computation ────────────────────────────────────────────────────

/** Median frame delta: the display's refresh interval when most frames are on time. */
export const estimateFrameInterval = (durations: readonly number[]): number => {
  if (durations.length === 0) return 0
  const sorted = [...durations].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2
}

/**
 * Stats for one window of frame samples. `frameIntervalMs` is the display's
 * refresh interval; when omitted it is estimated from the samples (median).
 */
export const computeStats = (
  samples: readonly FrameSample[],
  frameIntervalMs?: number,
): FrameRateStats => {
  if (samples.length === 0) return EMPTY_FRAME_RATE_STATS

  const interval = frameIntervalMs ?? estimateFrameInterval(samples.map((s) => s.duration))
  const droppedThreshold = interval * DROPPED_FRAME_FACTOR

  let total = 0
  let max = 0
  let dropped = 0

  for (const s of samples) {
    total += s.duration
    if (s.duration > max) max = s.duration
    if (s.duration > droppedThreshold) dropped += 1
  }

  const avg = total / samples.length
  const smoothness = ((samples.length - dropped) / samples.length) * 100

  return {
    fps: samples.length,
    avgFrameTime: Math.round(avg * 100) / 100,
    maxFrameTime: Math.round(max * 100) / 100,
    droppedFrames: dropped,
    smoothness: Math.round(smoothness * 10) / 10,
  }
}

// ── Collector ────────────────────────────────────────────────────────────────

export class FrameRateCollector implements Collector<FrameRateStats> {
  private readonly samples: RingBuffer<FrameSample>
  private readonly listeners = new Set<(stats: FrameRateStats) => void>()

  private rafId: number | null = null
  private lastTimestamp = 0
  private lastReportTime = 0
  private currentStats: FrameRateStats = EMPTY_FRAME_RATE_STATS
  private running = false
  // Window medians of recent reports (see INTERVAL_HISTORY_REPORTS).
  private intervalHistory: readonly number[] = []

  constructor(bufferCapacity = DEFAULT_BUFFER_CAPACITY) {
    this.samples = new RingBuffer<FrameSample>(bufferCapacity)
    this.tick = this.tick.bind(this)
  }

  start(): void {
    if (this.running) return
    // No rAF outside a browser (SSR, workers): stay stopped instead of throwing (C20).
    if (typeof requestAnimationFrame !== 'function') return
    this.running = true
    this.lastTimestamp = 0
    this.lastReportTime = 0
    this.samples.clear()
    this.intervalHistory = []
    this.currentStats = EMPTY_FRAME_RATE_STATS
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }

    this.samples.clear()
    this.intervalHistory = []
    this.lastTimestamp = 0
    this.lastReportTime = 0
    this.currentStats = EMPTY_FRAME_RATE_STATS
  }

  getStats(): FrameRateStats {
    return this.currentStats
  }

  onUpdate(callback: (stats: FrameRateStats) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private tick(now: number): void {
    if (!this.running) return

    // Record frame duration (skip first frame — no previous timestamp, and
    // skip a pause such as a hidden tab: it is not a frame).
    if (this.lastTimestamp > 0) {
      const duration = now - this.lastTimestamp
      if (duration > 0 && duration <= MAX_FRAME_GAP_MS) {
        this.samples.push({ timestamp: now, duration })
      }
    }
    this.lastTimestamp = now

    // Trim samples outside the rolling window in place — no allocation.
    const cutoff = now - SAMPLE_WINDOW_MS
    this.samples.trimHeadWhile((s) => s.timestamp < cutoff)

    // Report at reduced frequency (every 500 ms), so the copy and sort here
    // stay off the per-frame path.
    if (now - this.lastReportTime >= REPORT_INTERVAL_MS) {
      this.lastReportTime = now
      const stats = this.report()
      this.currentStats = stats
      this.notify(stats)
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private report(): FrameRateStats {
    const samples = this.samples.toArray()
    const windowInterval = estimateFrameInterval(samples.map((s) => s.duration))
    if (samples.length >= MIN_SAMPLES_FOR_INTERVAL) {
      this.intervalHistory = [...this.intervalHistory, windowInterval].slice(-INTERVAL_HISTORY_REPORTS)
    }
    const interval = this.intervalHistory.length > 0 ? Math.min(...this.intervalHistory) : windowInterval
    return computeStats(samples, interval)
  }

  // Coming back from (or going to) the background: the next rAF delta spans
  // the pause, so start measuring afresh from the next frame (C22).
  private readonly handleVisibilityChange = (): void => {
    this.lastTimestamp = 0
  }

  private notify(stats: FrameRateStats): void {
    for (const listener of this.listeners) {
      listener(stats)
    }
  }
}
