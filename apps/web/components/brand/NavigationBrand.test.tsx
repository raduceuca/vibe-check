import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NavigationWordmark, ProofVersion } from './NavigationBrand'

describe('navigation brand', () => {
  it('uses a print-production rosette and proper-case wordmark', () => {
    const markup = renderToStaticMarkup(<NavigationWordmark />)

    expect(markup).toContain('data-vc-press-rosette')
    expect(markup).toContain('Vibe')
    expect(markup).toContain('Check')
    expect(markup).not.toContain('vc-side-brand-dot')
  })

  it('presents the version as a proof notation', () => {
    const markup = renderToStaticMarkup(<ProofVersion version="0.2.0" />)

    expect(markup).toContain('data-vc-proof-version')
    expect(markup).toContain('PROOF')
    expect(markup).toContain('0.2.0')
    expect(markup).not.toContain('vc-side-ver-badge')
  })
})
