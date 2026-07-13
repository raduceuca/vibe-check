import { ArtSvg, ProcessPlate } from './artKit'
import { Node, Ring, OP, HAIR, C, pt } from './instrumentKit'

// dom-bloat (instrument grammar) — one focal node over-branching into far too
// many small child nodes. Six hairline primaries each fork into two twigs ending
// in tiny leaf-dots (12 children from one root); a faint dashed ambient ring
// marks the swelling boundary of the tree.
const PRIMARIES = [-90, -30, 30, 90, 150, -150] // evenly spaced branch bearings
const FORK = 26 // twig splay off each primary
const P_LEN = 9 // primary length
const T_LEN = 6.5 // twig length

const twigs = PRIMARIES.flatMap((deg) => {
  const [fx, fy] = pt(C, C, P_LEN, deg)
  return [deg - FORK, deg + FORK].map((td) => {
    const [tx, ty] = pt(fx, fy, T_LEN, td)
    return { key: `${deg}:${td}`, fx, fy, tx, ty }
  })
})

export const DomBloatArt = () => (
  <ArtSvg>
    {/* swelling boundary */}
    <ProcessPlate ink="cyan">
      <Ring r={20} opacity={OP.faint} dash="1.4 2.8" />
    </ProcessPlate>
    <ProcessPlate ink="magenta">
      <Ring r={18.8} opacity={0.22} dash="1.4 2.8" />
    </ProcessPlate>
    {/* branches: node → primary → two twigs */}
    <g fill="none" strokeWidth={HAIR} strokeOpacity={OP.line}>
      {PRIMARIES.map((deg) => {
        const [px, py] = pt(C, C, P_LEN, deg)
        return <line key={deg} x1={C} y1={C} x2={px} y2={py} />
      })}
      {twigs.map((t) => (
        <line key={t.key} x1={t.fx} y1={t.fy} x2={t.tx} y2={t.ty} />
      ))}
    </g>
    {/* leaf child-nodes — the proliferation */}
    {twigs.map((t) => (
      <circle key={t.key} cx={t.tx} cy={t.ty} r={1} fill="currentColor" fillOpacity={OP.line} stroke="none" />
    ))}
    {/* root */}
    <Node shape="square" r={2.6} />
  </ArtSvg>
)
