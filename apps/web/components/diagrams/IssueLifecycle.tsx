import { Node, Arrow, Label, DiagramSvg, DiagramFigure } from './primitives'

// IssueLifecycle — the two things an issue carries: a state and a severity. The
// state machine runs detected → acknowledged → resolved (each transition named
// after the MCP tool that drives it). The severity ladder below climbs from a
// quiet neutral info to the full fault accent at critical.

interface Sev {
  readonly name: string
  readonly color: string
  readonly dot: number
  readonly weight: number
  readonly opacity: number
  readonly ring: boolean
}

const SEVERITIES: readonly Sev[] = [
  { name: 'info', color: 'currentColor', dot: 3, weight: 500, opacity: 0.62, ring: false },
  { name: 'warning', color: 'var(--vc-dg-amber)', dot: 3.5, weight: 600, opacity: 1, ring: false },
  { name: 'error', color: 'var(--vc-dg-sig)', dot: 4, weight: 600, opacity: 1, ring: false },
  { name: 'critical', color: 'var(--vc-dg-sig)', dot: 4, weight: 700, opacity: 1, ring: true },
]

const CHIP_W = 126
const CHIP_H = 34
const CHIP_Y = 158
const CHIP_XS = [16, 158, 300, 442]

export const IssueLifecycle = () => (
  <DiagramFigure
    maxWidth={584}
    caption="Every issue has a state and a severity. It travels detected → acknowledged → resolved; acknowledging or resolving drops it from the active list."
  >
    <DiagramSvg
      viewBox="0 0 584 208"
      minWidth={500}
      title="The issue state machine and severity ladder"
      desc="An issue moves through three states: detected, then acknowledged via the acknowledge_issue tool, then resolved via the resolve_issue tool. Its severity climbs a four-step ladder — info, warning, error, critical — from a neutral tone up to the full fault accent."
    >
      {/* State machine: detected → acknowledged → resolved */}
      <Node
        x={16}
        y={30}
        w={120}
        h={60}
        kicker="State 1"
        label="detected"
        detail="in active list"
        accent="sig"
      />
      <Node
        x={232}
        y={30}
        w={120}
        h={60}
        kicker="State 2"
        label="acknowledged"
        detail="seen, muted"
      />
      <Node
        x={448}
        y={30}
        w={120}
        h={60}
        kicker="State 3"
        label="resolved"
        detail="fixed"
        accent="ok"
      />
      <Arrow x1={136} y1={60} x2={232} y2={60} />
      <Label x={184} y={52}>
        acknowledge_issue
      </Label>
      <Arrow x1={352} y1={60} x2={448} y2={60} />
      <Label x={400} y={52}>
        resolve_issue
      </Label>

      {/* Severity ladder */}
      <Label x={16} y={140} anchor="start" kind="kicker">
        Severity — increasing weight
      </Label>
      {SEVERITIES.map((s, i) => {
        const x = CHIP_XS[i]
        return (
          <g key={s.name}>
            <rect
              x={x}
              y={CHIP_Y}
              width={CHIP_W}
              height={CHIP_H}
              rx={8}
              fill="currentColor"
              fillOpacity={0.02}
              stroke={s.ring ? s.color : 'currentColor'}
              strokeOpacity={s.ring ? 0.4 : 0.16}
              strokeWidth={1}
            />
            {s.ring ? (
              <circle
                cx={x + 18}
                cy={CHIP_Y + CHIP_H / 2}
                r={s.dot + 2.5}
                fill="none"
                stroke={s.color}
                strokeOpacity={0.45}
                strokeWidth={1}
              />
            ) : null}
            <circle
              cx={x + 18}
              cy={CHIP_Y + CHIP_H / 2}
              r={s.dot}
              fill={s.color}
              fillOpacity={s.opacity}
            />
            <text
              x={x + 32}
              y={CHIP_Y + CHIP_H / 2 + 4}
              fontFamily='ui-monospace, "SF Mono", Menlo, monospace'
              fontSize={11}
              fontWeight={s.weight}
              letterSpacing="0.02em"
              fill={s.color}
              fillOpacity={s.opacity}
            >
              {s.name}
            </text>
          </g>
        )
      })}
    </DiagramSvg>
  </DiagramFigure>
)
