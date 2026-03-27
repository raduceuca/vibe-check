import type { FrameRateStats, Collector } from '../types.js'
import { EMPTY_FRAME_RATE_STATS } from '../types.js'
import { RingBuffer } from '../utils/ringBuffer.js'

// ── Constants ────────────────────────────────────────────────────────────────

const FRAME_BUDGET_MS = 1000 / 60 // 16.67ms — 60fps target
const SAMPLE_WINDOW_MS = 1000
const REPORT_INTERVAL_MS = 500

// Conservative max: at 240fps over 1s, 240 samples + headroom
const DEFAULT_BUFFER_CAPACITY = 300

// ── Types ────────────────────────────────────────────────────────────────────

interface FrameSample {
  readonly timestamp: number
  readonly duration: number
}

// ── Pure stat computation ────────────────────────────────────────────────────

export const computeStats = (samples: readonly FrameSample[]): FrameRateStats => {
  if (samples.length === 0) return EMPTY_FRAME_RATE_STATS

  let total = 0
  let max = 0
  let dropped = 0

  for (const s of samples) {
    total += s.duration
    if (s.duration > max) max = s.duration
    if (s.duration > FRAME_BUDGET_MS) dropped += 1
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

  constructor(bufferCapacity = DEFAULT_BUFFER_CAPACITY) {
    this.samples = new RingBuffer<FrameSample>(bufferCapacity)
    this.tick = this.tick.bind(this)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTimestamp = 0
    this.lastReportTime = 0
    this.samples.clear()
    this.currentStats = EMPTY_FRAME_RATE_STATS
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.samples.clear()
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

    // Record frame duration (skip first frame — no previous timestamp)
    if (this.lastTimestamp > 0) {
      const duration = now - this.lastTimestamp
      this.samples.push({ timestamp: now, duration })
    }
    this.lastTimestamp = now

    // Trim samples outside the rolling window by rebuilding from the ring
    // buffer. Since RingBuffer is ordered oldest-first, we filter in-place
    // by reading, filtering, clearing, and re-pushing.
    const cutoff = now - SAMPLE_WINDOW_MS
    const all = this.samples.toArray()
    const firstValidIndex = all.findIndex((s) => s.timestamp >= cutoff)

    if (firstValidIndex > 0) {
      this.samples.clear()
      for (let i = firstValidIndex; i < all.length; i++) {
        this.samples.push(all[i])
      }
    } else if (firstValidIndex === -1 && all.length > 0) {
      // All samples are stale
      this.samples.clear()
    }

    // Report at reduced frequency
    if (now - this.lastReportTime >= REPORT_INTERVAL_MS) {
      this.lastReportTime = now
      const stats = computeStats(this.samples.toArray())
      this.currentStats = stats
      this.notify(stats)
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private notify(stats: FrameRateStats): void {
    for (const listener of this.listeners) {
      listener(stats)
    }
  }
}
