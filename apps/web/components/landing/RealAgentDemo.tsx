'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export const shouldAutoplayDemo = (prefersReducedMotion: boolean): boolean =>
  !prefersReducedMotion

export type DemoPlayback = 'idle' | 'playing' | 'stopped'

export const demoControlLabel = (playback: DemoPlayback): string => {
  if (playback === 'playing') return 'Stop demo'
  return playback === 'stopped' ? 'Replay demo' : 'Play demo'
}

export const nextDemoPlayback = (playback: DemoPlayback): DemoPlayback =>
  playback === 'playing' ? 'stopped' : 'playing'

export const RealAgentDemo = () => {
  const [playback, setPlayback] = useState<DemoPlayback>('idle')
  const playing = playback === 'playing'

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (shouldAutoplayDemo(prefersReducedMotion)) setPlayback('playing')
  }, [])

  return (
    <figure className="vc-real-demo">
      <div className="vc-real-demo-frame">
        <div className="vc-real-demo-proof">
          <span className="vc-live-dot" /> real MCP round-trip
        </div>
        <button
          className="vc-real-demo-control"
          type="button"
          aria-pressed={playing}
          onClick={() => setPlayback(nextDemoPlayback)}
        >
          {demoControlLabel(playback)}
        </button>
        <Image
          className="vc-real-demo-image"
          src={playing
            ? '/demo/vibe-check-agent-roundtrip.gif'
            : '/demo/vibe-check-agent-roundtrip-poster.png'}
          alt="A real VibeCheck widget detects DOM bloat, connects to one watching agent, sends the issue, and shows the agent receipt"
          width={960}
          height={540}
          unoptimized
        />
      </div>
      <figcaption className="vc-real-demo-caption">
        <span>
          Recorded from the release E2E: packed npm packages, local hub, stdio
          bridge, and a real MCP SDK client. Delivery, verified fixes, and
          regressions come from VibeCheck&apos;s persisted local project ledger.
        </span>
        <Link className="vc-link vc-real-demo-link" href="/docs/quickstart">
          Run it locally →
        </Link>
      </figcaption>
    </figure>
  )
}
