import { ArtSvg } from './artKit'
import { Node, Arc, OP } from './instrumentKit'

// duplicate-requests (instrument grammar) — a beacon at the left emits one
// request as a solid broadcast arc; three dashed echoes trail behind it at
// growing radius. The identical arc, fired again and again = the duplicate.
const NX = 12 // emitter x (left of centre)
const NY = 24
const SPAN = 52 // arc half-angle around the 0° (rightward) bearing

const echoes = [
  { r: 24, opacity: OP.faint },
  { r: 19, opacity: OP.ambient },
  { r: 14, opacity: OP.ambient },
] as const

export const DuplicateRequestsArt = () => (
  <ArtSvg>
    {/* dashed echoes — the duplicates, furthest = faintest */}
    {echoes.map((e) => (
      <Arc key={e.r} r={e.r} a0={-SPAN} a1={SPAN} cx={NX} cy={NY} dashed opacity={e.opacity} />
    ))}
    {/* the original request — solid, in front */}
    <Arc r={9} a0={-SPAN} a1={SPAN} cx={NX} cy={NY} opacity={OP.line} />
    {/* emitter */}
    <Node shape="square" cx={NX} cy={NY} r={2.4} />
  </ArtSvg>
)
