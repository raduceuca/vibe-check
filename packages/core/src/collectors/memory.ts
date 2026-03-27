import type { HeapMemory, Collector } from '../types.js'
import { hasPerformanceMemory } from '../utils/featureDetect.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL_MS = 2000

// ── Chrome memory API shape ──────────────────────────────────────────────────

interface ChromePerformanceMemory {
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
}

interface PerformanceWithMemory extends Performance {
  readonly memory: ChromePerformanceMemory
}

// ── Pure read ────────────────────────────────────────────────────────────────

export const readHeapMemory = (): HeapMemory | null => {
  if (!hasPerformanceMemory()) return null

  const perf = performance as unknown as PerformanceWithMemory
  const mem = perf.memory
  const used = mem.usedJSHeapSize / (1024 * 1024)
  const total = mem.totalJSHeapSize / (1024 * 1024)

  return {
    jsHeapSizeMB: Math.round(used * 10) / 10,
    totalHeapSizeMB: Math.round(total * 10) / 10,
    usedPct:
      Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 1000) / 10,
  }
}

// ── Collector ────────────────────────────────────────────────────────────────

export class MemoryCollector implements Collector<HeapMemory | null> {
  private readonly pollIntervalMs: number
  private readonly listeners = new Set<(stats: HeapMemory | null) => void>()

  private intervalId: ReturnType<typeof setInterval> | null = null
  private currentStats: HeapMemory | null = null
  private running = false

  constructor(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) {
    this.pollIntervalMs = pollIntervalMs
  }

  start(): void {
    if (this.running) return

    if (!hasPerformanceMemory()) {
      // No memory API — still mark as running but stats stay null
      this.running = true
      this.currentStats = null
      return
    }

    this.running = true
    this.poll()
    this.intervalId = setInterval(() => this.poll(), this.pollIntervalMs)
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.currentStats = null
  }

  getStats(): HeapMemory | null {
    return this.currentStats
  }

  onUpdate(callback: (stats: HeapMemory | null) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private poll(): void {
    const stats = readHeapMemory()
    this.currentStats = stats
    this.notify(stats)
  }

  private notify(stats: HeapMemory | null): void {
    for (const listener of this.listeners) {
      listener(stats)
    }
  }
}
