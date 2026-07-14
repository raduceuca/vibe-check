import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CalibrationRuler,
  CropTicks,
  ProofControlStrip,
  ProofLabel,
  ProofRail,
  RegistrationConstellation,
  RegistrationTarget,
  StructuralRuleMark,
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

  it('marks the public control strip as the seven-pixel hero weight', () => {
    const markup = renderToStaticMarkup(<ProofControlStrip />)

    expect(markup).toContain('data-vc-proof-weight="hero"')
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

  it('composes a numbered section proof rail from the shared marks', () => {
    const markup = renderToStaticMarkup(
      <ProofRail label="PROOF 03" weight="section" />,
    )

    expect(markup).toContain('data-vc-proof-rail="section"')
    expect(markup).toContain('PROOF 03')
    expect(markup).toContain('data-vc-proof-control-strip')
    expect(markup).toContain('data-vc-crop-ticks="top-left"')
    expect(markup).toContain('data-vc-registration-target')
  })

  it('renders colored structural marks and neutral cut terminals', () => {
    const markup = renderToStaticMarkup(
      <>
        <StructuralRuleMark orientation="horizontal" color />
        <StructuralRuleMark orientation="vertical" />
      </>,
    )

    expect(markup).toContain('data-vc-structural-rule="horizontal"')
    expect(markup).toContain('data-vc-rule-color="true"')
    expect(markup).toContain('data-vc-structural-rule="vertical"')
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
