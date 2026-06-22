import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAeoDetector, blockedAiBots } from '../aeo.js'
import { resetIssueCounter } from '../createIssue.js'

describe('blockedAiBots (robots.txt parser)', () => {
  it('flags an AI bot disallowed from root', () => {
    expect(blockedAiBots('User-agent: GPTBot\nDisallow: /')).toContain('gptbot')
  })

  it('flags a wildcard root disallow', () => {
    expect(blockedAiBots('User-agent: *\nDisallow: /')).toContain('all crawlers (*)')
  })

  it('does not flag a scoped disallow', () => {
    expect(blockedAiBots('User-agent: GPTBot\nDisallow: /private')).toEqual([])
  })

  it('applies a shared rule block to consecutive user-agents', () => {
    const robots = 'User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /'
    const blocked = blockedAiBots(robots)
    expect(blocked).toContain('gptbot')
    expect(blocked).toContain('claudebot')
  })

  it('ignores comments and non-AI bots', () => {
    expect(blockedAiBots('# comment\nUser-agent: Googlebot\nDisallow: /')).toEqual([])
  })

  it('returns empty for an empty/permissive robots.txt', () => {
    expect(blockedAiBots('User-agent: *\nAllow: /')).toEqual([])
  })
})

const checksOf = (d: ReturnType<typeof createAeoDetector>): string[] =>
  d.getIssues().map((i) => i.evidence['check'] as string)

describe('aeo detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    vi.useFakeTimers()
    // Reject probes so async checks don't hit the network; cancelled-on-stop
    // keeps them out of the synchronous assertions.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network')))
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('has the correct name', () => {
    expect(createAeoDetector().name).toBe('aeo')
  })

  it('flags missing structured data (JSON-LD)', () => {
    const d = createAeoDetector()
    d.start()
    vi.advanceTimersByTime(600)
    expect(checksOf(d)).toContain('structured-data-missing')
    d.stop()
  })

  it('does not flag structured data when JSON-LD is present', () => {
    const script = document.createElement('script')
    script.setAttribute('type', 'application/ld+json')
    script.textContent = '{"@context":"https://schema.org","@type":"Organization","name":"Acme"}'
    document.head.appendChild(script)

    const d = createAeoDetector()
    d.start()
    vi.advanceTimersByTime(600)
    expect(checksOf(d)).not.toContain('structured-data-missing')
    d.stop()
  })

  it('clears issues', () => {
    const d = createAeoDetector()
    d.start()
    vi.advanceTimersByTime(600)
    expect(d.getIssues().length).toBeGreaterThan(0)
    d.clear()
    expect(d.getIssues()).toEqual([])
    d.stop()
  })
})
