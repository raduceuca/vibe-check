import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const PRODUCTION_ORIGIN = 'https://vibecheck.wcgw.fun'

const readAppFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

describe('production domain', () => {
  it('uses the owned WCGW origin for canonical metadata', async () => {
    const siteConfig = await readAppFile('lib/site.ts')

    assert.match(siteConfig, new RegExp(PRODUCTION_ORIGIN.replaceAll('.', '\\.')))
    assert.doesNotMatch(siteConfig, /vibecheck\.dev/)
  })

  it('uses the owned WCGW hostname in generated social images', async () => {
    const socialImageFiles = [
      'lib/problems/og.tsx',
      'app/opengraph-image.tsx',
      'app/fix/[slug]/opengraph-image.tsx',
      'app/fix/[slug]/[framework]/opengraph-image.tsx',
    ]
    const sources = await Promise.all(socialImageFiles.map(readAppFile))

    for (const source of sources) {
      assert.match(source, /vibecheck\.wcgw\.fun/)
      assert.doesNotMatch(source, /vibecheck\.dev/)
    }
  })

  it('binds the Cloudflare Worker to the owned WCGW hostname', async () => {
    const wranglerConfig = await readAppFile('wrangler.jsonc')

    assert.match(wranglerConfig, /"pattern":\s*"vibecheck\.wcgw\.fun"/)
    assert.match(wranglerConfig, /"custom_domain":\s*true/)
  })
})
