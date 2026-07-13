import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RealAgentDemo, shouldAutoplayDemo } from '../components/landing/RealAgentDemo'

describe('real agent demo playback', () => {
  it('defaults to the poster with an explicit play control', () => {
    const markup = renderToStaticMarkup(<RealAgentDemo />)

    expect(markup).toContain('vibe-check-agent-roundtrip-poster.png')
    expect(markup).not.toContain('vibe-check-agent-roundtrip.gif')
    expect(markup).toContain('Play demo')
  })

  it('does not autoplay for reduced-motion users', () => {
    expect(shouldAutoplayDemo(true)).toBe(false)
    expect(shouldAutoplayDemo(false)).toBe(true)
  })
})
