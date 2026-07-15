import { ArtSvg, ProcessPlate, type ProcessInk } from './artKit'
import { Node, Arc, OP, HAIR, C, pt } from './instrumentKit'

// memory-leak (instrument grammar) — concentric dashed rings expanding outward
// and dissolving as they grow, each one OPEN at the same bearing so the ring
// never closes; a single arrow breaks past the outermost ring and never returns
// to baseline. Unbounded growth as an instrument reading.
const ESCAPE = -52 // bearing of the opening + the escaping arrow (upper-right)
const GAP = 34 // angular gap that keeps every ring open

const arcs = [
  { r: 6, opacity: OP.line, ink: 'yellow' },
  { r: 11, opacity: OP.ambient, ink: 'magenta' },
  { r: 16.5, opacity: OP.faint, ink: 'cyan' },
] as const

export const MemoryLeakArt = () => {
  const [sx, sy] = pt(C, C, 3.5, ESCAPE) // arrow root, just off the node
  const [ax, ay] = pt(C, C, 22, ESCAPE) // arrow tip, beyond the last ring
  const [hx1, hy1] = pt(ax, ay, 3.6, ESCAPE + 148)
  const [hx2, hy2] = pt(ax, ay, 3.6, ESCAPE - 148)
  return (
    <ArtSvg>
      {arcs.map((a) => (
        <ProcessPlate key={a.r} ink={a.ink satisfies ProcessInk}>
          <Arc
            r={a.r}
            a0={ESCAPE + GAP / 2}
            a1={ESCAPE + 360 - GAP / 2}
            dashed
            opacity={a.opacity}
          />
        </ProcessPlate>
      ))}
      {/* growth breaking past the last ring, never returning */}
      <g fill="none" strokeWidth={HAIR} strokeOpacity={OP.line}>
        <line x1={sx} y1={sy} x2={ax} y2={ay} />
        <polyline points={`${hx1},${hy1} ${ax},${ay} ${hx2},${hy2}`} />
      </g>
      <Node shape="dot" r={2.2} />
    </ArtSvg>
  )
}
