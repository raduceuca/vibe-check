import { ArtSvg, ProcessPlate } from './artKit'
import { Node, Ring, Crosshair, Arc, OP, HAIR, C, pt } from './instrumentKit'

// seo (instrument grammar) — a radar scan: concentric dashed range-rings, a
// crosshair reticle with end ticks, a solid sweep arm with a faint trailing
// afterglow, and a single blip on a ring (the reading the audit finds). The
// page, scanned for search visibility.
const SWEEP = -34 // sweep-arm bearing (upper-right)

export const SeoArt = () => {
  const [sx, sy] = pt(C, C, 18.5, SWEEP)
  const [bx, by] = pt(C, C, 13, SWEEP + 3)
  return (
    <ArtSvg>
      <ProcessPlate ink="yellow">
        <Ring r={8} opacity={OP.ambient} />
      </ProcessPlate>
      <ProcessPlate ink="magenta">
        <Ring r={13} opacity={OP.ambient} />
      </ProcessPlate>
      <ProcessPlate ink="cyan">
        <Ring r={18.5} opacity={OP.faint} />
      </ProcessPlate>
      <Crosshair reach={21} gap={3.5} />
      {/* sweep afterglow trailing the arm */}
      <Arc r={18.5} a0={SWEEP + 4} a1={SWEEP + 34} dashed opacity={OP.faint} />
      {/* sweep arm */}
      <line x1={C} y1={C} x2={sx} y2={sy} strokeWidth={HAIR} strokeOpacity={OP.line} />
      {/* blip — the found reading */}
      <circle cx={bx} cy={by} r={1.5} fill="currentColor" fillOpacity={OP.node} stroke="none" />
      <Node shape="dot" r={2} />
    </ArtSvg>
  )
}
