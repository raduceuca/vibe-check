import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDuplicateRequestsDetector } from '../duplicateRequests.js'
import { resetIssueCounter } from '../createIssue.js'

describe('duplicateRequests detector', () => {
  const originalFetch = globalThis.fetch
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetIssueCounter()
    mockFetch = vi.fn().mockResolvedValue(new Response())
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should have the correct name', () => {
    const detector = createDuplicateRequestsDetector()
    expect(detector.name).toBe('duplicate-requests')
  })

  it('should start with no issues', () => {
    const detector = createDuplicateRequestsDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should detect duplicate fetch requests to the same URL', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    // Two calls to the same URL within 2 seconds
    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/users')

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].detector).toBe('duplicate-requests')
    expect(issues[0].evidence).toMatchObject({
      url: 'https://api.example.com/users',
      method: 'GET',
      count: 2,
      windowMs: 2000,
    })

    detector.stop()
  })

  it('should not flag different URLs as duplicates', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/posts')

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should not flag different methods as duplicates', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/users', { method: 'POST' })

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should handle URL objects in fetch', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    const url = new URL('https://api.example.com/data')
    await globalThis.fetch(url)
    await globalThis.fetch(url)

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)

    detector.stop()
  })

  it('should restore original fetch on stop()', () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    // fetch should be patched
    expect(globalThis.fetch).not.toBe(mockFetch)

    detector.stop()

    // fetch should be restored to what was there before start() (our mockFetch)
    expect(globalThis.fetch).toBe(mockFetch)
  })

  it('should chain through to original fetch', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/test')

    // The original mock should have been called
    expect(mockFetch).toHaveBeenCalledTimes(1)

    detector.stop()
  })

  it('should clear issues and tracking state', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/users')

    expect(detector.getIssues().length).toBe(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should only report each URL+method combo once', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/users')
    await globalThis.fetch('https://api.example.com/users')

    // Should still be just 1 issue (reported on 2nd call, not again on 3rd)
    expect(detector.getIssues().length).toBe(1)

    detector.stop()
  })

  it('should handle single request without reporting', async () => {
    const detector = createDuplicateRequestsDetector()
    detector.start()

    await globalThis.fetch('https://api.example.com/users')

    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })
})
