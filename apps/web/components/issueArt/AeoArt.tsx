import { ArtSvg } from './artKit'
import { Node, Arc, Ray, OP } from './instrumentKit'

// aeo (instrument grammar) — an outward broadcast to answer engines. The centre
// node emits three expanding dashed arcs on one side, fading with reach, and one
// solid ray carries to a target leaf-dot out on the far arc. The inverse of seo's
// inward radar sweep: this page transmits itself out to be cited.
const WAVES = [
  { r: 8, opacity: OP.line },
  { r: 13, opacity: OP.ambient },
  { r: 18, opacity: OP.faint },
] as const

export const AeoArt = () => (
  <ArtSvg>
    {/* broadcast, fading outward */}
    {WAVES.map((w) => (
      <Arc key={w.r} r={w.r} a0={-36} a1={36} dashed opacity={w.opacity} />
    ))}
    {/* reaching a target on the far arc */}
    <Ray deg={6} from={3.5} to={18} tip={1.5} opacity={OP.line} />
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
