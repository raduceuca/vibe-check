import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createConsoleSpamDetector } from '../consoleSpam.js'
import { resetIssueCounter } from '../createIssue.js'

describe('consoleSpam detector', () => {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    // Always restore originals in case test fails mid-run
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  })

  it('should have the correct name', () => {
    const detector = createConsoleSpamDetector()
    expect(detector.name).toBe('console-spam')
  })

  it('should start with no issues', () => {
    const detector = createConsoleSpamDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should detect excessive console.log calls', () => {
    const detector = createConsoleSpamDetector(10)
    detector.start()

    // Generate spam
    for (let i = 0; i < 15; i++) {
      console.log('spam', i)
    }

    // Trigger the check by advancing past the window
    vi.advanceTimersByTime(10_000)

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)
    expect(issues[0].detector).toBe('console-spam')
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].evidence).toHaveProperty('method', 'log')
    expect(issues[0].evidence).toHaveProperty('windowSeconds', 10)

    detector.stop()
  })

  it('should detect excessive console.warn calls', () => {
    const detector = createConsoleSpamDetector(10)
    detector.start()

    for (let i = 0; i < 15; i++) {
      console.warn('warning spam', i)
    }

    vi.advanceTimersByTime(10_000)

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)

    const warnIssue = issues.find(
      (iss) => (iss.evidence as Record<string, unknown>).method === 'warn',
    )
    expect(warnIssue).toBeDefined()

    detector.stop()
  })

  it('should detect excessive console.error calls', () => {
    const detector = createConsoleSpamDetector(10)
    detector.start()

    for (let i = 0; i < 15; i++) {
      console.error('error spam', i)
    }

    vi.advanceTimersByTime(10_000)

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)

    const errorIssue = issues.find(
      (iss) => (iss.evidence as Record<string, unknown>).method === 'error',
    )
    expect(errorIssue).toBeDefined()

    detector.stop()
  })

  it('should not flag when below threshold', () => {
    const detector = createConsoleSpamDetector(20)
    detector.start()

    for (let i = 0; i < 5; i++) {
      console.log('not spam')
    }

    vi.advanceTimersByTime(10_000)

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should pass through to original console methods', () => {
    const logSpy = vi.fn()
    console.log = logSpy

    const detector = createConsoleSpamDetector()
    detector.start()

    console.log('test message')

    // The spy (saved before patching) should have been called
    expect(logSpy).toHaveBeenCalledWith('test message')

    detector.stop()
  })

  it('should restore original console methods on stop()', () => {
    // Set up known originals
    const knownLog = vi.fn()
    const knownWarn = vi.fn()
    const knownError = vi.fn()
    console.log = knownLog
    console.warn = knownWarn
    console.error = knownError

    const detector = createConsoleSpamDetector()
    detector.start()

    // Console methods should be patched
    expect(console.log).not.toBe(knownLog)
    expect(console.warn).not.toBe(knownWarn)
    expect(console.error).not.toBe(knownError)

    detector.stop()

    // Console methods should be restored
    expect(console.log).toBe(knownLog)
    expect(console.warn).toBe(knownWarn)
    expect(console.error).toBe(knownError)
  })

  it('should clear issues and call history', () => {
    const detector = createConsoleSpamDetector(5)
    detector.start()

    for (let i = 0; i < 10; i++) {
      console.log('spam')
    }

    vi.advanceTimersByTime(10_000)
    expect(detector.getIssues().length).toBeGreaterThanOrEqual(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should truncate long arguments in evidence', () => {
    const detector = createConsoleSpamDetector(5)
    detector.start()

    const longString = 'x'.repeat(500)
    for (let i = 0; i < 10; i++) {
      console.log(longString)
    }

    vi.advanceTimersByTime(10_000)

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)

    const sampleArgs = issues[0].evidence.sampleArgs as string[]
    for (const arg of sampleArgs) {
      expect(arg.length).toBeLessThanOrEqual(203) // 200 + '...'
    }

    detector.stop()
  })

  it('should use configurable threshold', () => {
    const detector = createConsoleSpamDetector(3)
    detector.start()

    for (let i = 0; i < 4; i++) {
      console.log('spam')
    }

    vi.advanceTimersByTime(10_000)

    expect(detector.getIssues().length).toBeGreaterThanOrEqual(1)

    detector.stop()
  })
})
