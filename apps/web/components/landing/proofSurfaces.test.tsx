import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InstallCommand } from './InstallCommand'
import { LiveGauges } from './LiveGauges'
import { SectionHead } from './SectionHead'

describe('landing surfaces', () => {
  it('renders a plain section title without a proof rail', () => {
    const markup = renderToStaticMarkup(
      <SectionHead title="Every pass, measured" sub="live control strip" index="03" />,
    )

    expect(markup).toContain('<h2>Every pass, measured</h2>')
    expect(markup).not.toContain('data-vc-proof-rail')
    expect(markup).not.toContain('PROOF 03')
  })

  it('renders live gauges without calibration plates', () => {
    const markup = renderToStaticMarkup(<LiveGauges />)

    expect(markup).not.toContain('data-proof-index')
    expect(markup).not.toContain('data-vc-calibration-ruler')
    expect(markup).toContain('Frame rate')
  })

  it('renders the install command without crop ticks', () => {
    const markup = renderToStaticMarkup(
      <InstallCommand command="npm i @wcgw/vibe-check" />,
    )

    expect(markup).toContain('npm i @wcgw/vibe-check')
    expect(markup).not.toContain('K 100')
    expect(markup).not.toContain('data-vc-crop-ticks')
    expect(markup).not.toContain('data-vc-proof-surface')
  })
})
