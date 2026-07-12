import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleCollector } from '../console.js'

describe('ConsoleCollector', () => {
  let origLog: typeof console.log
  let origWarn: typeof console.warn
  let origError: typeof console.error

  beforeEach(() => {
    origLog = console.log
    origWarn = console.warn
    origError = console.error
  })

  afterEach(() => {
    // Defensive: never let a patched console leak into other tests.
    console.log = origLog
    console.warn = origWarn
    console.error = origError
  })

  it('patches console methods on start and counts calls', () => {
    // Replace the natives with silent sinks first so the wrapped calls produce
    // no test-output noise; the collector wraps these sinks.
    const logSink = vi.fn(); const warnSink = vi.fn(); const errSink = vi.fn()
    console.log = logSink as unknown as typeof console.log
    console.warn = warnSink as unknown as typeof console.warn
    console.error = errSink as unknown as typeof console.error

    const c = new ConsoleCollector()
    c.start()

    expect(console.log).not.toBe(logSink)

    console.log('a'); console.log('b')
    console.warn('w')
    console.error('e')

    const stats = c.getStats()
    expect(stats.logCount).toBe(2)
    expect(stats.warnCount).toBe(1)
    expect(stats.errorCount).toBe(1)
    expect(stats.totalCount).toBe(4)

    // The underlying sinks still received the forwarded calls.
    expect(logSink).toHaveBeenCalledTimes(2)
    expect(errSink).toHaveBeenCalledTimes(1)

    c.stop()
    expect(console.log).toBe(logSink)
  })

  it('restores the original console methods on stop()', () => {
    const c = new ConsoleCollector()
    c.start()
    expect(console.log).not.toBe(origLog)
    c.stop()
    expect(console.log).toBe(origLog)
    expect(console.warn).toBe(origWarn)
    expect(console.error).toBe(origError)
  })

  it('does not stack wrappers across repeated start/stop cycles', () => {
    const c = new ConsoleCollector()
    for (let i = 0; i < 5; i++) {
      c.start()
      c.stop()
    }
    expect(console.log).toBe(origLog)
    expect(console.warn).toBe(origWarn)
    expect(console.error).toBe(origError)
  })

  it('ownership check: stop() does not clobber a wrapper installed on top of it', () => {
    const c = new ConsoleCollector()
    c.start()
    const collectorWrapper = console.log

    // Another patcher wraps console.log on top of the collector.
    const outer = ((...args: unknown[]) => (collectorWrapper as (...a: unknown[]) => void)(...args)) as typeof console.log
    console.log = outer

    c.stop()

    // Our collector must NOT have restored — that would discard `outer`.
    expect(console.log).toBe(outer)

    // Cleanup: unwind the outer wrapper.
    console.log = origLog
  })

  it('double start() does not re-patch', () => {
    const c = new ConsoleCollector()
    c.start()
    const firstWrapper = console.log
    c.start()
    expect(console.log).toBe(firstWrapper)
    c.stop()
  })
})
