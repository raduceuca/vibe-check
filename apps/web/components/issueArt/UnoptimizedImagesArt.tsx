import { ArtSvg, ProcessPlate } from './artKit'
import { Node, Arc, OP, HAIR, C, pt } from './instrumentKit'

// unoptimized-images (instrument grammar) — served far larger than it renders. A
// big outlined square holds a much smaller nested target square; a dashed reduce-
// arc and an inward chevron in the gap point the surplus down to the size that
// was actually needed. Reads as "shrink to fit."
const RA = -45 // reduce cue bearing (upper-right gap)
const [vtx, vty] = pt(C, C, 5.4, RA) // chevron vertex (inner, points to centre)
const [cb1x, cb1y] = pt(C, C, 8.2, RA - 16)
const [cb2x, cb2y] = pt(C, C, 8.2, RA + 16)

export const UnoptimizedImagesArt = () => (
  <ArtSvg>
    {/* served size */}
    <ProcessPlate ink="cyan">
      <rect
        x={14}
        y={14}
        width={20}
        height={20}
        rx={1.5}
        fill="none"
        strokeWidth={HAIR}
        strokeOpacity={OP.ambient}
      />
    </ProcessPlate>
    {/* size actually needed */}
    <rect
      x={19}
      y={19}
      width={10}
      height={10}
      rx={1}
      fill="none"
      strokeWidth={HAIR}
      strokeOpacity={OP.line}
    />
    {/* reduce cue */}
    <ProcessPlate ink="magenta">
      <Arc r={7.6} a0={-66} a1={-24} dashed opacity={OP.ambient} />
    </ProcessPlate>
    <ProcessPlate ink="yellow">
      <polyline
        points={`${cb1x},${cb1y} ${vtx},${vty} ${cb2x},${cb2y}`}
        fill="none"
        strokeWidth={HAIR}
        strokeOpacity={OP.line}
      />
    </ProcessPlate>
    <Node shape="dot" r={2} />
  </ArtSvg>
)
