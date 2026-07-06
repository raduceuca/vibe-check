import { Node, Arrow, Label, DiagramSvg, DiagramFigure } from './primitives'

// BeaconRoundTrip — the two sides that meet at the store. The browser widget
// writes: it POSTs each snapshot through the MCP HTTP receiver into the immutable
// VibeStore. The agent reads: it calls the MCP tools, which read the same store
// and hand issues + fixes back. VibeStore is the shared middle both paths touch.

export const BeaconRoundTrip = () => (
  <DiagramFigure
    maxWidth={600}
    caption="One store, two sides. The browser writes snapshots in over HTTP; the agent reads issues out through the MCP tools. VibeStore is the shared middle."
  >
    <DiagramSvg
      viewBox="0 0 600 256"
      minWidth={520}
      title="The beacon round-trip through VibeStore"
      desc="On the write path, the browser widget's beacon POSTs each snapshot to the MCP HTTP receiver on port 4200, which validates it and folds it into the immutable VibeStore. On the read path, the AI agent calls the MCP tools, which read the same store and return issues and fix suggestions."
    >
      {/* Lane labels */}
      <Label x={110} y={16} kind="kicker">
        Write path
      </Label>
      <Label x={104} y={246} kind="kicker">
        Read path
      </Label>

      {/* Write path: browser → HTTP receiver → store */}
      <Node
        x={20}
        y={26}
        w={150}
        h={58}
        kicker="Browser"
        label="widget beacon"
        detail="BeaconClient"
      />
      <Node
        x={224}
        y={26}
        w={152}
        h={58}
        kicker="MCP HTTP"
        label=":4200 receiver"
        detail="zod-validated"
        mono
      />
      <Arrow x1={170} y1={55} x2={224} y2={55} />
      <Label x={197} y={46}>
        POST
      </Label>
      <Arrow x1={376} y1={55} x2={430} y2={102} />
      <Label x={402} y={92}>
        /api/snapshot
      </Label>

      {/* The shared middle */}
      <Node
        x={430}
        y={88}
        w={150}
        h={74}
        kicker="Immutable"
        label="VibeStore"
        detail="latest + 100 issues"
      />

      {/* Read path: agent ⇄ store */}
      <Node
        x={20}
        y={166}
        w={150}
        h={58}
        kicker="AI agent"
        label="MCP tools"
        detail="get_detected_issues"
        mono
      />
      <Arrow x1={170} y1={190} x2={428} y2={140} />
      <Label x={224} y={172}>
        reads
      </Label>
      <Arrow x1={428} y1={152} x2={170} y2={206} />
      <Label x={252} y={210}>
        issues + fixes
      </Label>
    </DiagramSvg>
  </DiagramFigure>
)
