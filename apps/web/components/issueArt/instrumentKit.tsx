import type { ReactElement } from 'react'

// ── instrument kit ───────────────────────────────────────────────────────────
// THE shared grammar for the detector glyphs. Every illustration in the Slop
// Bestiary is drawn as a tiny "instrument reading" in a single schematic
// language (borrowed from X Ads' diagram illustrations): ONE solid focal node,
// a uniform hairline for all structure, dashed ambient rings/arcs for
// signal/reach, and a crosshair reticle + rays radiating from the node. Each
// glyph reads as an instrument dial catching one specific fault — not a picture.
//
// Compatible with the shipping artKit shell: same 48² viewBox and single-tone
// `currentColor` (=== the card's --vc-ink), decorative + theme-aware. Every
// glyph built on these primitives drops into the live bestiary card slots. The
// one intentional shift from artKit is a finer hairline (1.2 vs 1.5) — the
// instrument look wants a thinner, more precise line. Monotone only: NO second
// colour ever; the card's severity dot carries hue, the shape carries meaning.

export const VIEW = 48
export const C = 24 // shared centre on both axes

// Uniform hairline for every structural stroke.
export const HAIR = 1.2

// Opacity ladder: solid structure → ambient dashes → far/faint echoes.
export const OP = {
  node: 0.92,
  line: 0.85,
  ambient: 0.5,
  faint: 0.32,
} as const

// Dash signatures — the "signal / ambient / reach" cue borrowed from X Ads.
export const DASH = {
  ring: '1.6 2.4',
  fine: '1 2.4',
  arc: '2 2.4',
} as const

const rad = (deg: number): number => (deg * Math.PI) / 180

// Polar → cartesian around a centre. Returns a fresh tuple (no mutation).
export const pt = (
  cx: number,
  cy: number,
  r: number,
  deg: number,
): readonly [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]

// ── Primitives ───────────────────────────────────────────────────────────────

interface NodeProps {
  readonly cx?: number
  readonly cy?: number
  readonly r?: number
  readonly shape?: 'square' | 'diamond' | 'dot'
}

// The one solid, filled mark — the focal node every glyph is built around.
export const Node = ({
  cx = C,
  cy = C,
  r = 2.4,
  shape = 'square',
}: NodeProps): ReactElement => {
  if (shape === 'dot') {
    return (
      <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={OP.node} stroke="none" />
    )
  }
  return (
    <rect
      x={cx - r}
      y={cy - r}
      width={r * 2}
      height={r * 2}
      rx={0.6}
      fill="currentColor"
      fillOpacity={OP.node}
      stroke="none"
      transform={shape === 'diamond' ? `rotate(45 ${cx} ${cy})` : undefined}
    />
  )
}

interface RingProps {
  readonly r: number
  readonly cx?: number
  readonly cy?: number
  readonly dashed?: boolean
  readonly opacity?: number
  readonly dash?: string
}

// A full concentric circle — dashed by default (ambient), solid on request.
export const Ring = ({
  r,
  cx = C,
  cy = C,
  dashed = true,
  opacity = OP.ambient,
  dash = DASH.ring,
}: RingProps): ReactElement => (
  <circle
    cx={cx}
    cy={cy}
    r={r}
    fill="none"
    strokeWidth={HAIR}
    strokeOpacity={opacity}
    strokeDasharray={dashed ? dash : undefined}
  />
)

interface ArcProps {
  readonly r: number
  readonly a0: number
  readonly a1: number
  readonly cx?: number
  readonly cy?: number
  readonly dashed?: boolean
  readonly opacity?: number
  readonly dash?: string
}

// A partial ring from bearing a0 → a1 (degrees). Powers broadcast arcs and the
// never-closing rings.
export const Arc = ({
  r,
  a0,
  a1,
  cx = C,
  cy = C,
  dashed = false,
  opacity = OP.line,
  dash = DASH.arc,
}: ArcProps): ReactElement => {
  const [x1, y1] = pt(cx, cy, r, a0)
  const [x2, y2] = pt(cx, cy, r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return (
    <path
      d={`M${x1} ${y1} A${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`}
      fill="none"
      strokeWidth={HAIR}
      strokeOpacity={opacity}
      strokeDasharray={dashed ? dash : undefined}
    />
  )
}

interface CrosshairProps {
  readonly reach?: number
  readonly gap?: number
  readonly cx?: number
  readonly cy?: number
  readonly ticks?: boolean
  readonly opacity?: number
}

// Axis lines through the centre with a gap around the node and end ticks — the
// instrument "reticle".
export const Crosshair = ({
  reach = 21,
  gap = 4,
  cx = C,
  cy = C,
  ticks = true,
  opacity = OP.line,
}: CrosshairProps): ReactElement => (
  <g fill="none" strokeWidth={HAIR} strokeOpacity={opacity}>
    <path
      d={`M${cx - reach} ${cy} H${cx - gap} M${cx + gap} ${cy} H${cx + reach} M${cx} ${cy - reach} V${cy - gap} M${cx} ${cy + gap} V${cy + reach}`}
    />
    {ticks ? (
      <path
        d={`M${cx - reach} ${cy - 2} v4 M${cx + reach} ${cy - 2} v4 M${cx - 2} ${cy - reach} h4 M${cx - 2} ${cy + reach} h4`}
      />
    ) : null}
  </g>
)

interface RayProps {
  readonly deg: number
  readonly from?: number
  readonly to: number
  readonly cx?: number
  readonly cy?: number
  readonly dashed?: boolean
  readonly opacity?: number
  readonly tip?: number
}

// A single line radiating from the node, optionally dashed, optionally ending in
// a small leaf-dot (the child node it reaches).
export const Ray = ({
  deg,
  from = 0,
  to,
  cx = C,
  cy = C,
  dashed = false,
  opacity = OP.line,
  tip,
}: RayProps): ReactElement => {
  const [x1, y1] = pt(cx, cy, from, deg)
  const [x2, y2] = pt(cx, cy, to, deg)
  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={HAIR}
        strokeOpacity={opacity}
        strokeDasharray={dashed ? DASH.arc : undefined}
      />
      {tip ? (
        <circle cx={x2} cy={y2} r={tip} fill="currentColor" fillOpacity={opacity} stroke="none" />
      ) : null}
    </>
  )
}
