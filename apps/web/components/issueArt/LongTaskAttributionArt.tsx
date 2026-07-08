import { ArtSvg } from './artKit'
import { Node, Ray, Ring, Arc, OP, HAIR, C, pt } from './instrumentKit'

// long-task-attribution (instrument grammar) — one task stalls the whole
// instrument. A single long ray shoots out past the range ring and ends in a
// stall tick (a wall it hits); the sweep arc that should circle freely is broken,
// halting either side of that ray. One blocking task, seizing the main thread.
const BLOCK = 10 // bearing of the blocking task ray

export const LongTaskAttributionArt = () => {
  const [tx, ty] = pt(C, C, 20, BLOCK) // ray tip
  const [w1x, w1y] = pt(tx, ty, 2.4, BLOCK + 90) // stall tick ends
  const [w2x, w2y] = pt(tx, ty, 2.4, BLOCK - 90)
  return (
    <ArtSvg>
      {/* range */}
      <Ring r={18} opacity={OP.faint} />
      {/* sweep halted either side of the blocking ray */}
      <Arc r={13} a0={16} a1={356} opacity={OP.ambient} />
      {/* the long blocking task, overrunning the range */}
      <Ray deg={BLOCK} from={3.5} to={20} opacity={OP.line} />
      {/* stall tick — the wall it hits */}
      <line x1={w1x} y1={w1y} x2={w2x} y2={w2y} strokeWidth={HAIR} strokeOpacity={OP.line} />
      <Node shape="dot" r={2.2} />
    </ArtSvg>
  )
}
