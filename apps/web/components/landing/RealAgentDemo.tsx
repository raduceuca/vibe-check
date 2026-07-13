import Image from 'next/image'
import Link from 'next/link'

export const RealAgentDemo = () => (
  <figure className="vc-real-demo">
    <div className="vc-real-demo-frame">
      <div className="vc-real-demo-proof">
        <span className="vc-live-dot" /> real MCP round-trip
      </div>
      <Image
        className="vc-real-demo-image"
        src="/demo/vibe-check-agent-roundtrip.gif"
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
