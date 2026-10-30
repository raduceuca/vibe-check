import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StepHead } from './StepHead'
import { HeroNote } from './HeroNote'
import { CopyButton } from './CopyButton'
import { RunTranscript } from './RunTranscript'

describe('landing surfaces', () => {
  it('renders StepHead without proof rails', () => {
    const markup = renderToStaticMarkup(
      <StepHead id="look-heading" title="This page, checked as you read it." lede="Five readings." />,
    )

    expect(markup).toContain('id="look-heading"')
    expect(markup).toContain('This page, checked as you read it.')
    expect(markup).not.toContain('data-vc-proof-rail')
    expect(markup).not.toContain('PROOF')
  })

  it('renders HeroNote without calibration marks', () => {
    const markup = renderToStaticMarkup(<HeroNote />)

    expect(markup).toContain('vc-hero-note')
    expect(markup).not.toContain('data-proof-index')
    expect(markup).not.toContain('data-vc-calibration-ruler')
    expect(markup).not.toContain('data-vc-crop-ticks')
  })

  it('renders CopyButton without proof surfaces', () => {
    const markup = renderToStaticMarkup(
      <CopyButton text="npx -y @wcgw/vibe-check-mcp@0.4.0 setup --agent cursor" />,
    )

    expect(markup).toContain('Copy')
    expect(markup).not.toContain('K 100')
    expect(markup).not.toContain('data-vc-crop-ticks')
    expect(markup).not.toContain('data-vc-proof-surface')
  })

  it('renders RunTranscript placeholder without inventing values', () => {
    const markup = renderToStaticMarkup(<RunTranscript />)

    expect(markup).toContain('Transcript of the run above')
    expect(markup).toContain('e2e recorder')
    expect(markup).not.toContain('watch_for_issue')
    expect(markup).not.toContain('PROOF')
  })
})
