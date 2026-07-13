import { describe, expect, it } from 'vitest'
import {
  getRewrittenUrl,
  isRewrite,
  unstable_getResponseFromNextConfig,
} from 'next/experimental/testing/server'
import { markdownRewrites } from '../lib/markdown-rewrites.mjs'

const nextConfig = { rewrites: markdownRewrites }

const responseFor = (path: string, accept = 'text/html') =>
  unstable_getResponseFromNextConfig({
    url: `https://vibecheck.wcgw.fun${path}`,
    headers: { accept },
    nextConfig,
  })

describe('markdown content rewrites', () => {
  it.each([
    ['/index.md', '/md/home'],
    ['/docs.md', '/md/docs'],
    ['/fix.md', '/md/fix'],
    ['/docs/quickstart.md', '/md/docs/quickstart'],
    ['/fix/performance/react.md', '/md/fix/performance/react'],
  ])('rewrites explicit Markdown URL %s', async (source, destination) => {
    const response = await responseFor(source)

    expect(isRewrite(response)).toBe(true)
    expect(getRewrittenUrl(response)).toBe(`https://vibecheck.wcgw.fun${destination}`)
  })

  it.each([
    ['/', '/md/home'],
    ['/docs', '/md/docs'],
    ['/docs/quickstart', '/md/docs/quickstart'],
    ['/fix/performance/react', '/md/fix/performance/react'],
  ])('negotiates %s when text/markdown is explicitly accepted', async (source, destination) => {
    const response = await responseFor(source, 'text/markdown, text/plain;q=0.8')

    expect(isRewrite(response)).toBe(true)
    expect(getRewrittenUrl(response)).toBe(`https://vibecheck.wcgw.fun${destination}`)
  })

  it.each([
    '/',
    '/docs/quickstart',
    '/api/scan',
    '/robots.txt',
    '/_next/static/app.js',
  ])('leaves ordinary or non-content request %s untouched', async (path) => {
    expect(isRewrite(await responseFor(path))).toBe(false)
  })
})
