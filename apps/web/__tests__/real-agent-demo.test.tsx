import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  RealAgentDemo,
  demoControlLabel,
  nextDemoPlayback,
  shouldAutoplayDemo,
} from '../components/landing/RealAgentDemo'

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

  it('describes animated GIF playback as stop and replay instead of pause', () => {
    expect(demoControlLabel('idle')).toBe('Play demo')
    expect(demoControlLabel('playing')).toBe('Stop demo')
    expect(demoControlLabel('stopped')).toBe('Replay demo')
    expect(nextDemoPlayback('playing')).toBe('stopped')
    expect(nextDemoPlayback('stopped')).toBe('playing')
  })
})
