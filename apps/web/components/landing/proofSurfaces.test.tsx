import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { InstallCommand } from './InstallCommand'
import { LiveGauges } from './LiveGauges'
import { SectionHead } from './SectionHead'

describe('landing proof surfaces', () => {
  it('numbers section rules like proof plates', () => {
    const markup = renderToStaticMarkup(
      <SectionHead title="Always measuring" sub="the live layer" index="03" />,
    )

    expect(markup).toContain('data-vc-section-proof="03"')
    expect(markup).toContain('PLATE 03')
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
