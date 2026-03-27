import type { ConsoleStats, Collector } from '../types.js'

type ConsoleMethod = 'log' | 'warn' | 'error'

export class ConsoleCollector implements Collector<ConsoleStats> {
  private logCount = 0
  private warnCount = 0
  private errorCount = 0
  private patched = false
  private originalLog: typeof console.log | null = null
  private originalWarn: typeof console.warn | null = null
  private originalError: typeof console.error | null = null
  private readonly listeners = new Set<(stats: ConsoleStats) => void>()

  start(): void {
    if (this.patched) return
    if (typeof console === 'undefined') return
    this.patched = true

    this.patchMethod('log')
    this.patchMethod('warn')
    this.patchMethod('error')
  }

  stop(): void {
    try {
      if (this.originalLog !== null) {
        console.log = this.originalLog
        this.originalLog = null
      }
      if (this.originalWarn !== null) {
        console.warn = this.originalWarn
        this.originalWarn = null
      }
      if (this.originalError !== null) {
        console.error = this.originalError
        this.originalError = null
      }
    } finally {
      this.patched = false
      this.logCount = 0
      this.warnCount = 0
      this.errorCount = 0
    }
  }

  getStats(): ConsoleStats {
    return {
      logCount: this.logCount,
      warnCount: this.warnCount,
      errorCount: this.errorCount,
      totalCount: this.logCount + this.warnCount + this.errorCount,
    }
  }

  onUpdate(callback: (stats: ConsoleStats) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private patchMethod(method: ConsoleMethod): void {
    const original = console[method]

    if (method === 'log') this.originalLog = original
    if (method === 'warn') this.originalWarn = original
    if (method === 'error') this.originalError = original

    const self = this
    const wrapped = (...args: unknown[]): void => {
      if (method === 'log') self.logCount++
      if (method === 'warn') self.warnCount++
      if (method === 'error') self.errorCount++
      self.notify()
      original.apply(console, args)
    }

    console[method] = wrapped
  }

  private notify(): void {
    const stats = this.getStats()
    for (const cb of this.listeners) {
      cb(stats)
    }
  }
}
