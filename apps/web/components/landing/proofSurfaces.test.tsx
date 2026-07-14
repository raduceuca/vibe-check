import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InstallCommand } from './InstallCommand'
import { LiveGauges } from './LiveGauges'
import { SectionHead } from './SectionHead'

describe('landing proof surfaces', () => {
  it('separates every numbered section with a compact proof rail', () => {
    const markup = renderToStaticMarkup(
      <SectionHead title="Every pass, measured" sub="live control strip" index="03" />,
    )

    expect(markup).toContain('data-vc-section-proof="03"')
    expect(markup.match(/data-vc-proof-rail="section"/g)).toHaveLength(1)
    expect(markup).toContain('PROOF 03')
    expect(markup).not.toContain('PLATE 03')
    expect(markup).toContain('<h2>Every pass, measured</h2>')
  })

  it('omits the proof rail when a section is unindexed', () => {
    const markup = renderToStaticMarkup(
      <SectionHead title="Every pass, measured" sub="live control strip" />,
    )

    expect(markup).not.toContain('data-vc-proof-rail')
    expect(markup).toContain('<h2>Every pass, measured</h2>')
  })

  it('indexes each live reading and carries a calibration ruler', () => {
    const markup = renderToStaticMarkup(<LiveGauges />)

    expect(markup.match(/data-proof-index=/g)).toHaveLength(6)
    expect(markup).toContain('data-proof-index="01"')
    expect(markup).toContain('data-proof-index="06"')
    expect(markup).toContain('data-vc-calibration-ruler="horizontal"')
  })

  it('treats the install command as a calibrated proof surface', () => {
    const markup = renderToStaticMarkup(
      <InstallCommand command="npm i @wcgw/vibe-check" />,
    )

    expect(markup).toContain('data-vc-proof-surface="install"')
    expect(markup).toContain('K 100')
    expect(markup).toContain('data-vc-crop-ticks="top-left"')
  })
})
