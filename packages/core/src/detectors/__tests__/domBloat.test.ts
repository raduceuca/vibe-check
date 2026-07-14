import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDomBloatDetector } from '../domBloat.js'
import { resetIssueCounter } from '../createIssue.js'

describe('domBloat detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should have the correct name', () => {
    const detector = createDomBloatDetector()
    expect(detector.name).toBe('dom-bloat')
  })

  it('should start with no issues', () => {
    const detector = createDomBloatDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should report warning when node count exceeds 800', () => {
    const mockElements = new Array(850).fill(null)
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      mockElements as unknown as NodeListOf<Element>,
    )

    // Mock documentElement for depth traversal
    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].detector).toBe('dom-bloat')
    expect(issues[0].evidence).toHaveProperty('nodeCount', 850)

    detector.stop()
  })

  it('should report error when node count exceeds 1500', () => {
    const mockElements = new Array(1600).fill(null)
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      mockElements as unknown as NodeListOf<Element>,
    )

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].evidence).toHaveProperty('nodeCount', 1600)

    detector.stop()
  })

  it('should not spam issues for repeated checks at same threshold', () => {
    const mockElements = new Array(900).fill(null)
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      mockElements as unknown as NodeListOf<Element>,
    )

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    // Advance past several poll intervals
    vi.advanceTimersByTime(15_000)

    // Should still be only one issue (from initial check)
    const issues = detector.getIssues()
    expect(issues.length).toBe(1)

    detector.stop()
  })

  it('should replace the active issue when threshold escalates from warn to error', () => {
    let nodeCount = 900
    vi.spyOn(document, 'querySelectorAll').mockImplementation(() => {
      return new Array(nodeCount).fill(null) as unknown as NodeListOf<Element>
    })

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    expect(detector.getIssues().length).toBe(1)
    expect(detector.getIssues()[0].severity).toBe('warning')

    // Escalate to error threshold
    nodeCount = 1600
    vi.advanceTimersByTime(5_000)

    expect(detector.getIssues().length).toBe(1)
    expect(detector.getIssues()[0].severity).toBe('error')

    detector.stop()
  })

  it('removes the active issue after the DOM returns below the threshold', () => {
    let nodeCount = 1_600
    vi.spyOn(document, 'querySelectorAll').mockImplementation(() =>
      new Array(nodeCount).fill(null) as unknown as NodeListOf<Element>)
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      document.createElement('div') as unknown as HTMLElement,
    )
    const detector = createDomBloatDetector()
    detector.start()
    expect(detector.getIssues()).toHaveLength(1)

    nodeCount = 100
    vi.advanceTimersByTime(5_000)

    expect(detector.getIssues()).toEqual([])
    detector.stop()
  })

  it('should clear all issues', () => {
    const mockElements = new Array(900).fill(null)
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      mockElements as unknown as NodeListOf<Element>,
    )

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    expect(detector.getIssues().length).toBe(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should stop all timers on stop()', () => {
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [] as unknown as NodeListOf<Element>,
    )

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const detector = createDomBloatDetector()
    detector.start()
    detector.stop()

    // Should have cleared both node and depth timers
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2)
  })

  it('should not report issues when node count is below threshold', () => {
    const mockElements = new Array(500).fill(null)
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      mockElements as unknown as NodeListOf<Element>,
    )

    const mockRoot = document.createElement('div')
    vi.spyOn(document, 'documentElement', 'get').mockReturnValue(
      mockRoot as unknown as HTMLElement,
    )

    const detector = createDomBloatDetector()
    detector.start()

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })
})
