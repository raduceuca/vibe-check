import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NavigationWordmark, ProofVersion } from './NavigationBrand'

describe('navigation brand', () => {
  it('uses a check mark and proper-case wordmark', () => {
    const markup = renderToStaticMarkup(<NavigationWordmark />)

    expect(markup).toContain('data-vc-brand-mark')
    expect(markup).toContain('Vibe')
    expect(markup).toContain('Check')
    expect(markup).not.toContain('data-vc-press-rosette')
  })

  it('presents the version without a proof label', () => {
    const markup = renderToStaticMarkup(<ProofVersion version="0.2.0" />)

    expect(markup).toContain('v0.2.0')
    expect(markup).not.toContain('PROOF')
    expect(markup).toContain('data-vc-site-version')
  })
})

