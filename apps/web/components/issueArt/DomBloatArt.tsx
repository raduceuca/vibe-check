import { ArtSvg, INK, FIRE, FIRE_OP, FIRE_FILL } from './artKit'

// dom-bloat — a nesting tree (1 → 2 → 6) whose leaf row explodes into far too
// many tiny nodes; the leaves are the fault accent.
export const DomBloatArt = () => (
  <ArtSvg>
    {/* root */}
    <rect
      x={21}
      y={6}
      width={6}
      height={5}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* children */}
    <rect
      x={11}
      y={19}
      width={7}
      height={5}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={30}
      y={19}
      width={7}
      height={5}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* connectors: root → children, children → leaf row */}
    <path
      d="M24 11 V15 M14.5 15 H33.5 M14.5 15 V19 M33.5 15 V19 M14.5 24 V28 M10 28 H19 M10 28 V32 M14.5 28 V32 M19 28 V32 M33.5 24 V28 M29 28 H38 M29 28 V32 M33.5 28 V32 M38 28 V32"
      strokeOpacity={INK.mid}
      fill="none"
    />
    {/* leaf explosion (fault) */}
    {[8.5, 13, 17.5, 27.5, 32, 36.5].map((x) => (
      <rect
        key={x}
        x={x}
        y={32}
        width={3}
        height={3}
        rx={0.8}
        stroke={FIRE}
        strokeOpacity={FIRE_OP}
        fill={FIRE}
        fillOpacity={FIRE_FILL}
      />
    ))}
  </ArtSvg>
)
