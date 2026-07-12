import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createWebEssentialsDetector } from '../webEssentials.js'
import { resetIssueCounter } from '../createIssue.js'

// jsdom's default document is missing favicon/viewport/lang/charset, so all four
// essential checks fail once runChecks fires.
describe('webEssentials detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('has the correct name and starts empty', () => {
    const detector = createWebEssentialsDetector()
    expect(detector.name).toBe('web-essentials')
    expect(detector.getIssues()).toEqual([])
  })

  it('runs checks after the start delay', () => {
    const detector = createWebEssentialsDetector()
    detector.start()
    vi.advanceTimersByTime(500)
    expect(detector.getIssues().length).toBeGreaterThan(0)
    detector.stop()
  })

  it('does no work after stop() — the pending timer is cleared', () => {
    const detector = createWebEssentialsDetector()
    detector.start()
    // Stop before the 500ms delay elapses.
    detector.stop()
    vi.advanceTimersByTime(2000)
    expect(detector.getIssues()).toEqual([])
  })

  it('runChecks is guarded by the stopped flag even if the timer somehow fires', () => {
    const detector = createWebEssentialsDetector()
    detector.start()
    detector.stop()
    detector.start() // restart
    detector.stop() // stop again
    vi.advanceTimersByTime(2000)
    expect(detector.getIssues()).toEqual([])
  })

  it('stop() is safe before start()', () => {
    const detector = createWebEssentialsDetector()
    expect(() => detector.stop()).not.toThrow()
  })
})
