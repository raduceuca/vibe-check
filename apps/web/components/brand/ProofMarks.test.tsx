import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CalibrationRuler,
  CropTicks,
  ProofControlStrip,
  ProofLabel,
  RegistrationConstellation,
  RegistrationTarget,
} from './ProofMarks'

describe('proof marks', () => {
  it('renders a varied, theme-driven control strip', () => {
    const markup = renderToStaticMarkup(<ProofControlStrip className="strip" />)

    expect(markup).toContain('aria-hidden="true"')
    expect(markup.match(/data-vc-proof-patch/g)).toHaveLength(8)
    expect(markup).toContain('data-width="12"')
    expect(markup).toContain('var(--vc-proof-c)')
    expect(markup).toContain('var(--vc-proof-m)')
    expect(markup).toContain('var(--vc-proof-y)')
    expect(markup).toContain('var(--vc-proof-k)')
  })

  it('renders reusable proof-control furniture', () => {
    const markup = renderToStaticMarkup(
      <>
        <CropTicks corner="top-right" />
        <ProofLabel>PROOF 01</ProofLabel>
        <CalibrationRuler />
        <RegistrationTarget />
      </>,
    )

    expect(markup).toContain('data-vc-crop-ticks')
    expect(markup).toContain('PROOF 01')
    expect(markup).toContain('data-vc-calibration-ruler')
    expect(markup).toContain('data-vc-registration-target')
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
