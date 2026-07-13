'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export const shouldAutoplayDemo = (prefersReducedMotion: boolean): boolean =>
  !prefersReducedMotion

export const RealAgentDemo = () => {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    setPlaying(shouldAutoplayDemo(prefersReducedMotion))
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
          onClick={() => setPlaying((current) => !current)}
        >
          {playing ? 'Pause demo' : 'Play demo'}
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
          bridge, and a real MCP SDK client. The receipt appears only after the
          agent receives the issue.
        </span>
        <Link className="vc-link vc-real-demo-link" href="/docs/quickstart">
          Run it locally →
        </Link>
      </figcaption>
    </figure>
  )
}
