import { Node, Arrow, Elbow, Label, DiagramSvg, DiagramFigure } from './primitives'

// ArchitectureDiagram — the four packages and the seam between them. The browser
// side (core → react → your app) and the agent side (mcp, standalone) never share
// a runtime import: they meet only at the shared `protocol` contract and across a
// single HTTP POST (the beacon). The dashed vertical rule is that seam.

const DIVIDER = 300

export const ArchitectureDiagram = () => (
  <DiagramFigure
    maxWidth={580}
    caption="Four packages, one seam. core → react → your app on the browser side; mcp stands alone on the agent side. They share only the protocol contract and one HTTP POST — never a runtime import."
  >
    <DiagramSvg
      viewBox="0 0 580 336"
      minWidth={520}
      title="VibeCheck package architecture"
      desc="The protocol package is the shared contract feeding core and mcp. On the browser side, core is depended on by react which is used by your app. On the agent side, the standalone mcp package runs an HTTP receiver plus MCP tools and talks to the AI agent over stdio. The browser and agent sides connect only through a single POST to /api/snapshot."
    >
      {/* Lanes */}
      <line
        x1={DIVIDER}
        y1={40}
        x2={DIVIDER}
        y2={316}
        stroke="currentColor"
        strokeOpacity={0.14}
        strokeWidth={1}
        strokeDasharray="2 5"
      />
      <Label x={150} y={26} kind="kicker">
        Browser side
      </Label>
      <Label x={452} y={26} kind="kicker">
        Agent side
      </Label>

      {/* Shared protocol contract, straddling the seam */}
      <Node
        x={215}
        y={40}
        w={170}
        h={54}
        kicker="Contract"
        label="protocol"
        detail="VibeSnapshot · VibeIssue"
        mono
      />
      {/* protocol feeds both sides */}
      <Elbow
        dashed
        points={[
          [250, 94],
          [250, 107],
          [127, 107],
          [127, 118],
        ]}
      />
      <Elbow
        dashed
        points={[
          [350, 94],
          [350, 118],
          [453, 118],
          [453, 132],
        ]}
      />
      <Label x={186} y={104}>
        type-only
      </Label>
      <Label x={414} y={114}>
        zod schema
      </Label>

      {/* Browser side chain: core → react → your app */}
      <Node
        x={36}
        y={118}
        w={182}
        h={54}
        kicker="Core"
        label="collectors + detectors"
        detail="zero runtime deps"
      />
      <Node
        x={36}
        y={194}
        w={182}
        h={54}
        kicker="React"
        label="<VibeCheck /> overlay"
        detail="peer: React 18+"
      />
      <Node
        x={36}
        y={270}
        w={182}
        h={54}
        kicker="Your app"
        label="mounts the widget"
        detail="renders your UI"
      />
      <Arrow x1={127} y1={172} x2={127} y2={194} />
      <Arrow x1={127} y1={248} x2={127} y2={270} />

      {/* Agent side: mcp (standalone) → AI agent */}
      <Node
        x={362}
        y={132}
        w={182}
        h={72}
        kicker="MCP"
        label="HTTP receiver + tools"
        detail="localhost:4200 · stdio"
        mono
      />
      <Node
        x={362}
        y={246}
        w={182}
        h={54}
        kicker="AI agent"
        label="reads 6 MCP tools"
        detail="over stdio"
      />
      <Arrow x1={453} y1={204} x2={453} y2={246} />

      {/* The one wire across the seam */}
      <Arrow dashed x1={218} y1={214} x2={362} y2={190} />
      <Label x={292} y={188}>
        POST /api/snapshot
      </Label>
    </DiagramSvg>
  </DiagramFigure>
)
