import type {
  LongFrameStats,
  LongFrameEntry,
  ScriptAttribution,
  Collector,
} from '../types.js'
import { EMPTY_LONG_FRAME_STATS } from '../types.js'
import { hasLongAnimationFrame } from '../utils/featureDetect.js'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_ENTRIES_DEFAULT = 50

// ── Internal types for the raw LoAF entry ────────────────────────────────────

interface RawScriptEntry {
  readonly sourceURL?: string
  readonly sourceFunctionName?: string
  readonly duration?: number
}

interface RawLoAFEntry extends PerformanceEntry {
  readonly blockingDuration?: number
  readonly scripts?: readonly RawScriptEntry[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100

const parseScripts = (
  scripts: readonly RawScriptEntry[] | undefined
): readonly ScriptAttribution[] => {
  if (!scripts || scripts.length === 0) return []

  return scripts.map((s) => ({
    sourceURL: s.sourceURL ?? '',
    sourceFunctionName: s.sourceFunctionName ?? '',
    duration: round2(s.duration ?? 0),
  }))
}

const toEntry = (raw: RawLoAFEntry): LongFrameEntry => ({
  duration: round2(raw.duration),
  startTime: round2(raw.startTime),
  blockingDuration: round2(raw.blockingDuration ?? 0),
  scripts: parseScripts(raw.scripts),
})

// ── Collector ────────────────────────────────────────────────────────────────

export class LongFrameCollector implements Collector<LongFrameStats> {
  private readonly maxEntries: number
  private readonly listeners = new Set<(stats: LongFrameStats) => void>()

  private observer: PerformanceObserver | null = null
  private entries: LongFrameEntry[] = []
  private count = 0
  private worstFrame = 0
  private running = false

  constructor(maxEntries = MAX_ENTRIES_DEFAULT) {
    this.maxEntries = maxEntries
  }

  start(): void {
    if (this.running) return

    if (!hasLongAnimationFrame()) return

    this.running = true
    this.entries = []
    this.count = 0
    this.worstFrame = 0

    this.observer = new PerformanceObserver((list) => {
      this.handleEntries(list.getEntries() as readonly RawLoAFEntry[])
    })

    try {
      this.observer.observe({ type: 'long-animation-frame', buffered: true })
    } catch {
      this.running = false
      this.observer = null
    }
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  getStats(): LongFrameStats {
    if (!this.running) return EMPTY_LONG_FRAME_STATS

    return {
      count: this.count,
      entries: [...this.entries],
      worstFrame: this.worstFrame,
    }
  }

  onUpdate(callback: (stats: LongFrameStats) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  clear(): void {
    this.entries = []
    this.count = 0
    this.worstFrame = 0
    this.notify()
  }

  private handleEntries(rawEntries: readonly RawLoAFEntry[]): void {
    const incoming = rawEntries.map(toEntry)

    this.count += incoming.length

    const incomingWorst = incoming.reduce(
      (max, e) => (e.duration > max ? e.duration : max),
      0
    )
    if (incomingWorst > this.worstFrame) {
      this.worstFrame = round2(incomingWorst)
    }

    // Keep only the most recent maxEntries
    this.entries = [...this.entries, ...incoming].slice(-this.maxEntries)

    this.notify()
  }

  private notify(): void {
    const stats = this.getStats()
    for (const listener of this.listeners) {
      listener(stats)
    }
  }
}
