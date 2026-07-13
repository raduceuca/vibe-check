import { Node, Arrow, Elbow, DiagramSvg, DiagramFigure } from './primitives'
import type { Accent } from './primitives'

// PipelineDiagram — the flagship. The full symptom→fix round-trip, left to right:
// Browser collectors → VibeCheckEngine → Beacon → MCP server → AI agent → Fix.
// The fault surfaces at the agent (signal accent) and resolves at the fix (ok).
//
// Two layouts share one stage list: a two-row serpentine for wide viewports and
// a vertical stack for narrow ones (toggled by the .vc-dg-wide / .vc-dg-narrow
// media rule in global.css) — so node text stays large at every width instead of
// scaling down to nothing.

interface Stage {
  readonly kicker: string
  readonly label: string
  readonly detail: string
  readonly mono?: boolean
  readonly accent?: Accent
}

const STAGES: readonly Stage[] = [
  { kicker: 'Browser', label: 'Collectors', detail: 'sample the page' },
  {
    kicker: 'Engine',
    label: 'VibeCheckEngine',
    detail: 'snapshot · 500ms',
    mono: true,
  },
  {
    kicker: 'Beacon',
    label: 'POST /api/snapshot',
    detail: 'every 2s',
    mono: true,
  },
  {
    kicker: 'MCP server',
    label: 'localhost:4200',
    detail: 'holds VibeStore',
    mono: true,
  },
  {
    kicker: 'AI agent',
    label: 'get_detected_issues',
    detail: 'reads the evidence',
    mono: true,
    accent: 'sig',
  },
  { kicker: 'Fix', label: 'proposes the diff', detail: 'you review & ship', accent: 'ok' },
]

const stageNode = (s: Stage, x: number, y: number, w: number, h: number) => (
  <Node
    x={x}
    y={y}
    w={w}
    h={h}
    kicker={s.kicker}
    label={s.label}
    detail={s.detail}
    mono={s.mono}
    accent={s.accent}
  />
)

const RegistrationPin = ({ x, y }: { readonly x: number; readonly y: number }) => (
  <g
    className="vc-dg-register"
    transform={`translate(${x} ${y})`}
    data-vc-registration-target=""
    aria-hidden="true"
  >
    <circle cx="0" cy="0" r="4" />
    <path d="M-7 0h14M0-7v14" />
  </g>
)

// Two-row serpentine: Browser · Engine · Beacon  ↴  MCP · Agent · Fix
const Wide = () => {
  const w = 180
  const h = 62
  const xs = [20, 230, 440]
  const yTop = 22
  const yBot = 130
  const cyTop = yTop + h / 2
  const cyBot = yBot + h / 2
  return (
    <DiagramSvg
      viewBox="0 0 640 210"
      title="The VibeCheck round-trip pipeline"
      desc="Browser collectors feed the VibeCheckEngine, which the beacon POSTs to the MCP server on localhost:4200; the AI agent reads the detected issues and proposes the fix."
    >
      {/* Row 1 */}
      {STAGES.slice(0, 3).map((s, i) => (
        <g key={s.kicker}>{stageNode(s, xs[i], yTop, w, h)}</g>
      ))}
      <Arrow x1={xs[0] + w} y1={cyTop} x2={xs[1]} y2={cyTop} />
      <Arrow x1={xs[1] + w} y1={cyTop} x2={xs[2]} y2={cyTop} />
      <RegistrationPin x={xs[2] - 15} y={cyTop} />

      {/* Serpentine turn: end of row 1 → start of row 2 */}
      <Elbow
        points={[
          [xs[2] + w / 2, yTop + h],
          [xs[2] + w / 2, yTop + h + 23],
          [xs[0] + w / 2, yTop + h + 23],
          [xs[0] + w / 2, yBot],
        ]}
      />

      {/* Row 2 */}
      {STAGES.slice(3).map((s, i) => (
        <g key={s.kicker}>{stageNode(s, xs[i], yBot, w, h)}</g>
      ))}
      <Arrow x1={xs[0] + w} y1={cyBot} x2={xs[1]} y2={cyBot} />
      <Arrow x1={xs[1] + w} y1={cyBot} x2={xs[2]} y2={cyBot} />
      <RegistrationPin x={xs[2] - 15} y={cyBot} />
    </DiagramSvg>
  )
}

// Vertical stack for narrow viewports.
const Narrow = () => {
  const w = 268
  const h = 54
  const x = 16
  const step = 80
  const y0 = 12
  return (
    <DiagramSvg
      viewBox="0 0 300 478"
      minWidth={280}
      title="The VibeCheck round-trip pipeline"
      desc="Browser collectors feed the VibeCheckEngine, which the beacon POSTs to the MCP server on localhost:4200; the AI agent reads the detected issues and proposes the fix."
    >
      {STAGES.map((s, i) => {
        const y = y0 + i * step
        return (
          <g key={s.kicker}>
            {stageNode(s, x, y, w, h)}
            {i < STAGES.length - 1 ? (
              <>
                <Arrow x1={x + w / 2} y1={y + h} x2={x + w / 2} y2={y + step} />
                {i === 1 || i === 4 ? (
                  <RegistrationPin x={x + w / 2} y={y + h + 13} />
                ) : null}
              </>
            ) : null}
          </g>
        )
      })}
    </DiagramSvg>
  )
}

export const PipelineDiagram = () => (
  <DiagramFigure
    maxWidth={900}
    caption="The loop that was missing from vibe coding: the browser measures, the beacon ships it, your agent reads the evidence — and proposes the fix."
  >
    <div className="vc-dg-wide">
      <Wide />
    </div>
    <div className="vc-dg-narrow" style={{ maxWidth: 320, margin: '0 auto' }}>
      <Narrow />
    </div>
  </DiagramFigure>
)
