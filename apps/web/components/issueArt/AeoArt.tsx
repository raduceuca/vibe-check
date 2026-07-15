import { ArtSvg, ProcessPlate, type ProcessInk } from './artKit'
import { Node, Arc, Ray, OP } from './instrumentKit'

// aeo (instrument grammar) — an outward broadcast to answer engines. The centre
// node emits three expanding dashed arcs on one side, fading with reach, and one
// solid ray carries to a target leaf-dot out on the far arc. The inverse of seo's
// inward radar sweep: this page transmits itself out to be cited.
const WAVES = [
  { r: 8, opacity: OP.line, ink: 'yellow' },
  { r: 13, opacity: OP.ambient, ink: 'magenta' },
  { r: 18, opacity: OP.faint, ink: 'cyan' },
] as const

export const AeoArt = () => (
  <ArtSvg>
    {/* broadcast, fading outward */}
    {WAVES.map((w) => (
      <ProcessPlate key={w.r} ink={w.ink satisfies ProcessInk}>
        <Arc r={w.r} a0={-36} a1={36} dashed opacity={w.opacity} />
      </ProcessPlate>
    ))}
    {/* reaching a target on the far arc */}
    <Ray deg={6} from={3.5} to={18} tip={1.5} opacity={OP.line} />
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
