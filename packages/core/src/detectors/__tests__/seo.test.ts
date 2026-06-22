import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSeoDetector } from '../seo.js'
import { resetIssueCounter } from '../createIssue.js'

const checksOf = (detector: ReturnType<typeof createSeoDetector>): string[] =>
  detector.getIssues().map((i) => i.evidence['check'] as string)

// Drive the detector's deferred runChecks() synchronously.
const run = (detector: ReturnType<typeof createSeoDetector>): void => {
  detector.start()
  vi.advanceTimersByTime(500)
}

describe('seo detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
    // Same-origin probes reject → treated as "can't probe", so sitemap/robots
    // don't pollute the synchronous assertions.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')))
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    document.title = ''
    document.documentElement.removeAttribute('lang')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('has the correct name', () => {
    expect(createSeoDetector().name).toBe('seo')
  })

  it('flags a bare page across discoverability checks', () => {
    document.title = ''
    const img = document.createElement('img') // no alt
    document.body.appendChild(img)

    const d = createSeoDetector()
    run(d)
    const checks = checksOf(d)

    expect(checks).toContain('title-missing')
    expect(checks).toContain('meta-description-missing')
    expect(checks).toContain('og-image-missing')
    expect(checks).toContain('canonical-missing')
    expect(checks).toContain('h1-missing')
    expect(checks).toContain('image-alt-missing')
    d.stop()
  })

  it('passes a well-formed page', () => {
    // Set head contents first — assigning head.innerHTML replaces the <title>
    // element, so document.title must be set AFTER.
    document.head.innerHTML = `
      <meta name="description" content="Acme makes invoicing painless for freelancers and small studios.">
      <meta property="og:title" content="Acme">
      <meta property="og:description" content="Invoicing for freelancers">
      <meta property="og:image" content="https://acme.com/og.png">
      <link rel="canonical" href="https://acme.com/">
    `
    document.title = 'Acme — Invoicing for freelancers'
    const h1 = document.createElement('h1'); h1.textContent = 'Acme'
    const img = document.createElement('img'); img.setAttribute('alt', 'logo')
    document.body.append(h1, img)

    const d = createSeoDetector()
    run(d)
    const checks = checksOf(d)

    expect(checks).not.toContain('title-missing')
    expect(checks).not.toContain('meta-description-missing')
    expect(checks).not.toContain('og-image-missing')
    expect(checks).not.toContain('canonical-missing')
    expect(checks).not.toContain('h1-missing')
    expect(checks).not.toContain('image-alt-missing')
    d.stop()
  })

  it('flags a placeholder/default title as an error', () => {
    document.title = 'Vite + React'
    const d = createSeoDetector()
    run(d)
    const issue = d.getIssues().find((i) => i.evidence['check'] === 'title-default')
    expect(issue).toBeDefined()
    expect(issue?.severity).toBe('error')
    d.stop()
  })

  it('flags an over-long title with the length in detail', () => {
    document.title = 'A'.repeat(80)
    const d = createSeoDetector()
    run(d)
    const issue = d.getIssues().find((i) => i.evidence['check'] === 'title-too-long')
    expect(issue).toBeDefined()
    expect(issue?.evidence['detail']).toBe('80 chars')
    d.stop()
  })

  it('flags multiple h1 elements', () => {
    document.title = 'OK title that is fine'
    document.body.innerHTML = '<h1>One</h1><h1>Two</h1>'
    const d = createSeoDetector()
    run(d)
    expect(checksOf(d)).toContain('h1-multiple')
    d.stop()
  })

  it('clears issues and cancels late probes on stop', () => {
    document.title = ''
    const d = createSeoDetector()
    run(d)
    expect(d.getIssues().length).toBeGreaterThan(0)
    d.clear()
    expect(d.getIssues()).toEqual([])
    d.stop()
  })
})
