import { readFileSync } from 'node:fs'
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
  const globalStyles = readFileSync(
    new URL('../../app/global.css', import.meta.url),
    'utf8',
  )

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

  it('defines visible dimensions for the semantic hero weight', () => {
    expect(
      /\[data-vc-proof-weight='hero'\]\s*{\s*height: 8px;/.test(globalStyles),
    ).toBe(true)
    expect(
      /\[data-vc-proof-weight='hero'\] i\s*{\s*height: 7px;/.test(
        globalStyles,
      ),
    ).toBe(true)
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

  it('sizes section crop tick strokes to the section crop container', () => {
    expect(
      /\[data-vc-proof-rail='section'\] \[data-vc-crop-ticks\] i:first-child\s*{\s*width: 10px;/.test(
        globalStyles,
      ),
    ).toBe(true)
    expect(
      /\[data-vc-proof-rail='section'\] \[data-vc-crop-ticks\] i:last-child\s*{\s*height: 10px;/.test(
        globalStyles,
      ),
    ).toBe(true)
  })

  it('renders colored structural marks and neutral cut terminals', () => {
    const coloredMarkup = renderToStaticMarkup(
      <StructuralRuleMark orientation="horizontal" color />,
    )
    const neutralMarkup = renderToStaticMarkup(
      <StructuralRuleMark orientation="vertical" />,
    )

    expect(coloredMarkup).toContain('data-vc-structural-rule="horizontal"')
    expect(coloredMarkup).toContain('data-vc-rule-color="true"')
    expect(neutralMarkup).toContain('data-vc-structural-rule="vertical"')
    expect(neutralMarkup).not.toContain('data-vc-rule-color="true"')
    expect(neutralMarkup).not.toContain('data-vc-proof-control-strip')
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
