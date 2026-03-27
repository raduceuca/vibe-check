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

const computeP98 = (durations: readonly number[]): number => {
  if (durations.length === 0) return 0
  const sorted = [...durations].sort((a, b) => a - b)
  const index = Math.ceil(0.98 * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

export class WebVitalsCollector implements Collector<WebVitalsStats> {
  private lcpValue: number | null = null
  private readonly eventDurations: number[] = []
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

    const inpValue = computeP98(this.eventDurations)
    const inp =
      this.eventDurations.length > 0
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
      const entries = list.getEntries() as ReadonlyArray<PerformanceEntry & { readonly duration: number }>
      for (const entry of entries) {
        this.eventDurations.push(entry.duration)
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
