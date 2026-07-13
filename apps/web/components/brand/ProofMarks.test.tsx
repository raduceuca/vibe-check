import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProofRail, RegistrationConstellation } from './ProofMarks'

describe('proof marks', () => {
  it('renders a decorative, theme-driven process rail', () => {
    const markup = renderToStaticMarkup(<ProofRail className="rail" />)

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('var(--vc-proof-c)')
    expect(markup).toContain('var(--vc-proof-m)')
    expect(markup).toContain('var(--vc-proof-y)')
    expect(markup).toContain('var(--vc-proof-k)')
  })

  it('renders a decorative registration constellation', () => {
    const markup = renderToStaticMarkup(
      <RegistrationConstellation className="target" />,
    )

    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('focusable="false"')
    expect(markup).toContain('vc-registration-plate')
  })
})
