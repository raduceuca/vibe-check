import type { WebVitalsStats, VitalRating, Collector } from '../types.js'
import { hasLargestContentfulPaint, hasEventTiming, hasLayoutShift } from '../utils/featureDetect.js'

const rateVital = (value: number, thresholds: [number, number]): VitalRating => {
  if (value <= thresholds[0]) return 'good'
  if (value <= thresholds[1]) return 'needs-improvement'
  return 'poor'
}

const LCP_THRESHOLDS: [number, number] = [2500, 4000]
const INP_THRESHOLDS: [number, number] = [200, 500]
const CLS_THRESHOLDS: [number, number] = [0.1, 0.25]

/** Maximum gap between layout shifts within a session window (1 second). */
const CLS_SESSION_GAP_MS = 1000
/** Maximum duration of a session window (5 seconds). */
const CLS_SESSION_MAX_MS = 5000

interface LayoutShiftEntry {
  readonly value: number
  readonly startTime: number
  readonly hadRecentInput: boolean
}

interface SessionWindow {
  readonly startTime: number
  readonly lastTime: number
  readonly sum: number
}

const computeCLS = (entries: readonly LayoutShiftEntry[]): number => {
  const filtered = entries.filter((e) => !e.hadRecentInput)
  if (filtered.length === 0) return 0

  let maxWindowSum = 0
  let currentWindow: SessionWindow = {
    startTime: filtered[0].startTime,
    lastTime: filtered[0].startTime,
    sum: filtered[0].value,
  }

  for (let i = 1; i < filtered.length; i++) {
    const entry = filtered[i]
    const gapFromLast = entry.startTime - currentWindow.lastTime
    const windowDuration = entry.startTime - currentWindow.startTime

    if (gapFromLast <= CLS_SESSION_GAP_MS && windowDuration <= CLS_SESSION_MAX_MS) {
      // Entry fits in the current session window
      currentWindow = {
        ...currentWindow,
        lastTime: entry.startTime,
        sum: currentWindow.sum + entry.value,
      }
    } else {
      // Finalize current window, start a new one
      maxWindowSum = Math.max(maxWindowSum, currentWindow.sum)
      currentWindow = {
        startTime: entry.startTime,
        lastTime: entry.startTime,
        sum: entry.value,
      }
    }
  }

  // Finalize last window
  maxWindowSum = Math.max(maxWindowSum, currentWindow.sum)

  return maxWindowSum
}

// ── INP ──────────────────────────────────────────────────────────────────────
// INP is per interaction, not per event (C9). Event entries with
// interactionId 0 (hover, pointerover, mouseout, ...) are not interactions and
// are ignored. Each interaction counts once, at its longest entry. Like the
// web-vitals library, only the 10 longest interactions are kept, and INP is the
// longest after ignoring one per 50 interactions (a p98 approximation).

/** How many of the longest interactions are kept. */
const MAX_TRACKED_INTERACTIONS = 10
const INTERACTIONS_PER_IGNORED_OUTLIER = 50

interface InteractionSample {
  readonly id: number
  readonly duration: number
}

interface EventTimingEntry {
  readonly duration: number
  readonly interactionId?: number
}

/** Adds one entry to the longest-interactions list (sorted longest first). Returns a new list, or the same one when nothing changed. */
export const recordInteraction = (
  longest: readonly InteractionSample[],
  id: number,
  duration: number,
): readonly InteractionSample[] => {
  const existing = longest.find((sample) => sample.id === id)
  if (existing !== undefined && duration <= existing.duration) return longest
  const shortest = longest[longest.length - 1]
  if (
    existing === undefined
    && longest.length >= MAX_TRACKED_INTERACTIONS
    && shortest !== undefined
    && duration <= shortest.duration
  ) {
    return longest
  }
  const others = longest.filter((sample) => sample.id !== id)
  return [...others, { id, duration }]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, MAX_TRACKED_INTERACTIONS)
}

/** INP from the longest interactions and the total number of interactions on the page. */
export const computeInp = (longest: readonly InteractionSample[], interactionCount: number): number | null => {
  if (longest.length === 0) return null
  const index = Math.min(
    longest.length - 1,
    Math.floor(Math.max(interactionCount, longest.length) / INTERACTIONS_PER_IGNORED_OUTLIER),
  )
  return longest[index]?.duration ?? null
}

// Chromium exposes the page's interaction count, including interactions too
// fast to produce an event entry; fall back to the ones this collector saw.
const browserInteractionCount = (): number | null => {
  if (typeof performance === 'undefined') return null
  const count: unknown = (performance as Performance & { readonly interactionCount?: unknown }).interactionCount
  return typeof count === 'number' && Number.isFinite(count) ? count : null
}

export class WebVitalsCollector implements Collector<WebVitalsStats> {
  private lcpValue: number | null = null
  private longestInteractions: readonly InteractionSample[] = []
  // Interaction ids only grow, so a new highest id is a new interaction.
  private maxInteractionId = 0
  private seenInteractions = 0
  private readonly layoutShiftEntries: LayoutShiftEntry[] = []
  private readonly observers: PerformanceObserver[] = []
  private readonly listeners: Set<(stats: WebVitalsStats) => void> = new Set()

  start(): void {
    this.observeLCP()
    this.observeINP()
    this.observeCLS()
  }

  stop(): void {
    for (const observer of this.observers) {
      observer.disconnect()
    }
    ;(this.observers as PerformanceObserver[]).splice(0)
  }

  getStats(): WebVitalsStats {
    const lcp =
      this.lcpValue !== null
        ? { value: this.lcpValue, rating: rateVital(this.lcpValue, LCP_THRESHOLDS) }
        : null

    const inpValue = computeInp(
      this.longestInteractions,
      browserInteractionCount() ?? this.seenInteractions,
    )
    const inp =
      inpValue !== null
        ? { value: inpValue, rating: rateVital(inpValue, INP_THRESHOLDS) }
        : null

    const clsValue = computeCLS(this.layoutShiftEntries)
    const cls =
      this.layoutShiftEntries.length > 0
        ? { value: clsValue, rating: rateVital(clsValue, CLS_THRESHOLDS) }
        : null

    return { lcp, inp, cls }
  }

  onUpdate(callback: (stats: WebVitalsStats) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notify(): void {
    const stats = this.getStats()
    for (const cb of this.listeners) {
      cb(stats)
    }
  }

  private observeLCP(): void {
    if (!hasLargestContentfulPaint()) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries.length > 0) {
        // Chrome updates LCP until user interaction; always take the LAST entry
        const last = entries[entries.length - 1] as PerformanceEntry & { readonly startTime: number }
        this.lcpValue = last.startTime
        this.notify()
      }
    })

    observer.observe({ type: 'largest-contentful-paint', buffered: true })
    this.observers.push(observer)
  }

  private observeINP(): void {
    if (!hasEventTiming()) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as readonly EventTimingEntry[]
      for (const entry of entries) {
        const id = entry.interactionId
        if (typeof id !== 'number' || id <= 0) continue
        if (id > this.maxInteractionId) {
          this.maxInteractionId = id
          this.seenInteractions += 1
        }
        this.longestInteractions = recordInteraction(this.longestInteractions, id, entry.duration)
      }
      this.notify()
    })

    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
    this.observers.push(observer)
  }

  private observeCLS(): void {
    if (!hasLayoutShift()) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as readonly LayoutShiftEntry[]
      for (const entry of entries) {
        this.layoutShiftEntries.push({
          value: entry.value,
          startTime: entry.startTime,
          hadRecentInput: entry.hadRecentInput,
        })
      }
      this.notify()
    })

    observer.observe({ type: 'layout-shift', buffered: true })
    this.observers.push(observer)
  }
}
