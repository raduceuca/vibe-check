import { describe, expect, it } from 'vitest'
import { getIssueIdentity, getStableIssueKey, normalizePageUrl, type VibeIssue } from '../index.js'

const issue = (
  evidence: Record<string, unknown>,
  detector: VibeIssue['detector'] = 'seo',
  title = 'Missing title',
): VibeIssue => ({
  id: `occurrence-${Math.random()}`,
  detector,
  severity: 'warning',
  title,
  description: '',
  evidence,
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
})

describe('stable issue identity', () => {
  it('ignores query, hash, occurrence id, title, and changing measurements', () => {
    const first = getStableIssueKey(
      'shop',
      'http://localhost:3000/pricing?a=1#top',
      issue({ check: 'h1-multiple', detail: '2 found' }),
    )
    const second = getStableIssueKey(
      'shop',
      'http://localhost:3000/pricing?a=2#bottom',
      issue({ check: 'h1-multiple', detail: '5 found' }, 'seo', 'Several headings'),
    )

    expect(first).toBe(second)
  })

  it('keeps projects, pages, checks, methods, and resource URLs distinct', () => {
    expect(normalizePageUrl('http://localhost:3000/pricing?q=1#x'))
      .toBe('http://localhost:3000/pricing')

    expect(getStableIssueKey('shop', 'http://localhost/a', issue({ check: 'h1-missing' })))
      .not.toBe(getStableIssueKey('shop', 'http://localhost/b', issue({ check: 'h1-missing' })))
    expect(getStableIssueKey('shop', 'http://localhost/a', issue({ check: 'h1-missing' })))
      .not.toBe(getStableIssueKey('admin', 'http://localhost/a', issue({ check: 'h1-missing' })))
    expect(getStableIssueKey(
      'shop',
      'http://localhost/a',
      issue({ method: 'GET', url: '/api/products', count: 2 }, 'duplicate-requests'),
    )).not.toBe(getStableIssueKey(
      'shop',
      'http://localhost/a',
      issue({ method: 'POST', url: '/api/products', count: 2 }, 'duplicate-requests'),
    ))
    expect(getStableIssueKey(
      'shop',
      'http://localhost/a',
      issue({ src: '/hero-a.jpg' }, 'large-images'),
    )).not.toBe(getStableIssueKey(
      'shop',
      'http://localhost/a',
      issue({ src: '/hero-b.jpg' }, 'large-images'),
    ))
  })

  it('exposes a page-independent identity for keyed, in-place issue updates', () => {
    const first = issue({ method: 'log', callCount: 20 }, 'console-spam', 'Console spam')
    const second = issue({ method: 'log', callCount: 90 }, 'console-spam', 'Heavy console spam')
    expect(getIssueIdentity(first)).toBe('console-spam|log')
    expect(getIssueIdentity(first)).toBe(getIssueIdentity(second))
    expect(getIssueIdentity(issue({ method: 'warn' }, 'console-spam'))).not.toBe(getIssueIdentity(first))
    expect(getIssueIdentity(issue({ check: 'h1-missing' }))).toBe('seo|h1-missing')
    expect(getIssueIdentity(issue({}, 'dom-bloat'))).toBe('dom-bloat|dom-bloat')
  })

  it('normalizes malformed relative URLs without throwing', () => {
    expect(normalizePageUrl('/pricing?q=one#plans')).toBe('/pricing')
  })
})
