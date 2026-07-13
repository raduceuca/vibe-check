import { describe, expect, it } from 'vitest'
import {
  formatSmokeResults,
  runProductionSmoke,
} from '../production-smoke.mjs'

describe('release tooling test harness', () => {
  it('runs tooling tests in a Node environment', () => {
    expect(typeof process.versions.node).toBe('string')
  })
})

const ORIGIN = 'https://vibecheck.wcgw.fun'

const passingBody = (pathname: string): string => {
  if (pathname === '/') return `<html><head><title>VibeCheck</title><link rel="canonical" href="${ORIGIN}"></head></html>`
  if (pathname === '/docs/quickstart') return '<html><title>Quickstart</title>@wcgw/vibe-check-mcp</html>'
  if (pathname === '/robots.txt') return `User-agent: *\nSitemap: ${ORIGIN}/sitemap.xml\n`
  if (pathname === '/sitemap.xml') return `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url></urlset>`
  if (pathname === '/llms.txt') return '# VibeCheck\nBrowser performance monitoring for AI-assisted coding.'
  return 'x'.repeat(2_048)
}

const passingType = (pathname: string): string => {
  if (pathname === '/opengraph-image') return 'image/png'
  if (pathname === '/sitemap.xml') return 'application/xml'
  if (pathname === '/robots.txt' || pathname === '/llms.txt') return 'text/plain; charset=utf-8'
  return 'text/html; charset=utf-8'
}

const passingFetch = async (input: string | URL | Request): Promise<Response> => {
  const pathname = new URL(String(input)).pathname
  return new Response(passingBody(pathname), {
    status: 200,
    headers: { 'content-type': passingType(pathname) },
  })
}

describe('production smoke checks', () => {
  it('validates every public production route', async () => {
    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl: passingFetch,
      retries: 1,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results).toHaveLength(6)
    expect(results.every((result) => result.ok)).toBe(true)
    expect(results.map((result) => result.path)).toEqual([
      '/',
      '/docs/quickstart',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/opengraph-image',
    ])
  })

  it('retries a transient edge failure and reports the attempt count', async () => {
    let homeAttempts = 0
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/' && homeAttempts++ === 0) return new Response('temporary', { status: 500 })
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 2,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results.find((result) => result.path === '/')).toMatchObject({ ok: true, attempts: 2 })
  })

  it('fails a persistent content-type mismatch with an actionable reason', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/opengraph-image') {
        return new Response('not an image', { status: 200, headers: { 'content-type': 'text/plain' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 2,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })
    const image = results.find((result) => result.path === '/opengraph-image')

    expect(image).toMatchObject({ ok: false, attempts: 2, status: 200 })
    expect(image?.reason).toContain('image/png')
    expect(formatSmokeResults(results)).toContain('FAIL /opengraph-image')
  })

  it('names the missing route assertion in formatted output', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/robots.txt') {
        return new Response('User-agent: *', { status: 200, headers: { 'content-type': 'text/plain' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 1,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(formatSmokeResults(results)).toContain(`FAIL /robots.txt`)
    expect(formatSmokeResults(results)).toContain(`${ORIGIN}/sitemap.xml`)
  })
})
