import type { CSSProperties, ReactNode } from 'react'

// ── Diagram primitives ───────────────────────────────────────────────────────
// Shared building blocks for the hand-drawn SVG diagram kit. Everything neutral
// is painted with `currentColor` (+ opacity), so a diagram automatically follows
// the host text colour — readable in BOTH the landing (`.vc-landing`) and the
// Fumadocs docs pages, in light and dark, with zero hardcoded neutrals. The only
// colour that must actively flip per theme is the fault/ok accent; those come
// from the `--vc-dg-*` tokens declared in app/global.css (scoped to `.vc-dg`).

const MONO =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace'
const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'

export type Accent = 'sig' | 'amber' | 'ok'

const ACCENT: Record<Accent, string> = {
  sig: 'var(--vc-dg-sig)',
  amber: 'var(--vc-dg-amber)',
  ok: 'var(--vc-dg-ok)',
}

// Neutral opacities — one ladder, reused everywhere so every diagram reads the
// same weight of ink at the same role.
const NODE_STROKE = 0.16
const NODE_FILL = 0.025
const KICKER = 0.5
const LABEL = 0.94
const DETAIL = 0.5
const LINE = 0.3
const HEAD = 0.5

interface NodeProps {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h?: number
  readonly kicker?: string
  readonly label: string
  readonly detail?: string
  readonly mono?: boolean
  readonly accent?: Accent
}

// A labelled box: mono kicker (uppercase, tracked) over a title, optional detail
// line, optional accent (tinted hairline stroke + corner dot) for a fault/ok node.
export const Node = ({
  x,
  y,
  w,
  h = 58,
  kicker,
  label,
  detail,
  mono,
  accent,
}: NodeProps) => {
  const stroke = accent ? ACCENT[accent] : 'currentColor'
  const strokeOpacity = accent ? 0.55 : NODE_STROKE
  const fill = accent ? ACCENT[accent] : 'currentColor'
  const fillOpacity = accent ? 0.05 : NODE_FILL
  const pad = 13
  const hasKicker = Boolean(kicker)
  // Anchor the text block to the node's vertical centre (cy) rather than a fixed
  // offset from the top, so tall nodes stay balanced instead of top-weighted. The
  // per-line offsets keep the original 17px / 15px baseline gaps and are tuned so
  // the block's ink is optically centred (kicker caps to detail descenders).
  const cy = y + h / 2
  const kickerY = detail ? cy - 14 : cy - 8
  const labelY = hasKicker ? (detail ? cy + 3 : cy + 11) : cy + 4
  const detailY = cy + 18

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={9}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeOpacity={strokeOpacity}
        strokeWidth={1}
      />
      {kicker ? (
        <text
          x={x + pad}
          y={kickerY}
          fontFamily={MONO}
          fontSize={8.5}
          letterSpacing="0.11em"
          fill="currentColor"
          fillOpacity={KICKER}
        >
          {kicker.toUpperCase()}
        </text>
      ) : null}
      <text
        x={x + pad}
        y={labelY}
        fontFamily={mono ? MONO : SANS}
        fontSize={mono ? 11 : 12.5}
        fontWeight={600}
        fill="currentColor"
        fillOpacity={LABEL}
      >
        {label}
      </text>
      {detail ? (
        <text
          x={x + pad}
          y={detailY}
          fontFamily={SANS}
          fontSize={9.5}
          fill="currentColor"
          fillOpacity={DETAIL}
        >
          {detail}
        </text>
      ) : null}
      {accent ? (
        <circle cx={x + w - 12} cy={y + 12} r={3.2} fill={ACCENT[accent]} />
      ) : null}
    </g>
  )
}

const headPoints = (size: number): string =>
  `0,0 ${-size},${-size * 0.55} ${-size},${size * 0.55}`

interface ArrowProps {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly dashed?: boolean
  readonly headSize?: number
}

// A straight directional connector: hairline stem + a filled arrowhead rotated to
// point along the segment (works at any angle — horizontal, vertical, diagonal).
export const Arrow = ({
  x1,
  y1,
  x2,
  y2,
  dashed,
  headSize = 6,
}: ArrowProps) => {
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeOpacity={LINE}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeDasharray={dashed ? '3 3' : undefined}
      />
      <polygon
        points={headPoints(headSize)}
        fill="currentColor"
        fillOpacity={HEAD}
        transform={`translate(${x2} ${y2}) rotate(${angle})`}
      />
    </g>
  )
}

interface ElbowProps {
  readonly points: ReadonlyArray<readonly [number, number]>
  readonly dashed?: boolean
  readonly headSize?: number
}

// A right-angled (or multi-segment) connector through `points`, with the
// arrowhead on the final segment. Used for cross-lane / serpentine routing.
export const Elbow = ({ points, dashed, headSize = 6 }: ElbowProps) => {
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const angle = (Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180) / Math.PI
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
    .join(' ')
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeOpacity={LINE}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '3 3' : undefined}
      />
      <polygon
        points={headPoints(headSize)}
        fill="currentColor"
        fillOpacity={HEAD}
        transform={`translate(${last[0]} ${last[1]}) rotate(${angle})`}
      />
    </g>
  )
}

interface LabelProps {
  readonly x: number
  readonly y: number
  readonly children: string
  readonly anchor?: 'start' | 'middle' | 'end'
  readonly kind?: 'kicker' | 'edge'
  readonly opacity?: number
}

// Free-standing mono text — lane labels, edge captions, the "500ms" hint.
export const Label = ({
  x,
  y,
  children,
  anchor = 'middle',
  kind = 'edge',
  opacity,
}: LabelProps) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontFamily={MONO}
    fontSize={kind === 'kicker' ? 8.5 : 9}
    letterSpacing={kind === 'kicker' ? '0.11em' : '0.02em'}
    fill="currentColor"
    fillOpacity={opacity ?? (kind === 'kicker' ? KICKER : 0.55)}
  >
    {kind === 'kicker' ? children.toUpperCase() : children}
  </text>
)

interface DiagramSvgProps {
  readonly viewBox: string
  readonly title: string
  readonly desc: string
  readonly minWidth?: number
  readonly children: ReactNode
}

// The <svg> shell: accessible (role=img + title/desc), fluid (width 100% / height
// auto from the viewBox), tabular numerals, and an optional pixel `minWidth` so a
// dense diagram scrolls (via the figure's overflow-x) instead of shrinking to an
// illegible size on narrow screens.
export const DiagramSvg = ({
  viewBox,
  title,
  desc,
  minWidth,
  children,
}: DiagramSvgProps) => (
  <svg
    role="img"
    aria-label={title}
    viewBox={viewBox}
    xmlns="http://www.w3.org/2000/svg"
    style={{
      display: 'block',
      width: '100%',
      height: 'auto',
      minWidth: minWidth ? `${minWidth}px` : undefined,
      color: 'inherit',
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    <title>{title}</title>
    <desc>{desc}</desc>
    {children}
  </svg>
)

interface DiagramFigureProps {
  readonly caption?: ReactNode
  readonly maxWidth?: number
  readonly style?: CSSProperties
  readonly children: ReactNode
}

// The outer <figure>: carries the `.vc-dg` accent-token scope, centres and caps
// the width, provides horizontal scroll for over-min-width diagrams, and renders
// a quiet mono caption below.
export const DiagramFigure = ({
  caption,
  maxWidth = 640,
  style,
  children,
}: DiagramFigureProps) => (
  <figure className="vc-dg" style={{ margin: '22px auto', padding: 0, ...style }}>
    <div style={{ maxWidth, margin: '0 auto', overflowX: 'auto' }}>{children}</div>
    {caption ? (
      <figcaption
        style={{
          maxWidth,
          margin: '11px auto 0',
          fontFamily: MONO,
          fontSize: 11.5,
          lineHeight: 1.55,
          textAlign: 'center',
          color: 'currentColor',
          opacity: 0.55,
        }}
      >
        {caption}
      </figcaption>
    ) : null}
  </figure>
)
