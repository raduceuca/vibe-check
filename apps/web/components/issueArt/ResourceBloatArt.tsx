import { ArtSvg, INK, FIRE, FIRE_OP, FIRE_FILL } from './artKit'

// resource-bloat — transferred-byte bars whose tops cross the budget line; the
// over-budget caps are the fault accent.
export const ResourceBloatArt = () => (
  <ArtSvg>
    {/* baseline */}
    <path d="M6 40 H42" strokeOpacity={INK.mid} fill="none" />
    {/* under-budget bars */}
    <rect
      x={9}
      y={26}
      width={6}
      height={14}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={27}
      y={22}
      width={6}
      height={18}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* over-budget bars: neutral base + fault cap above the line */}
    <rect
      x={18}
      y={18}
      width={6}
      height={22}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={18}
      y={12}
      width={6}
      height={6}
      rx={1}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
    <rect
      x={36}
      y={18}
      width={6}
      height={22}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={36}
      y={10}
      width={6}
      height={8}
      rx={1}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
    {/* budget line */}
    <path
      d="M6 18 H42"
      strokeOpacity={INK.strong}
      strokeDasharray="3 2.5"
      fill="none"
    />
  </ArtSvg>
)
