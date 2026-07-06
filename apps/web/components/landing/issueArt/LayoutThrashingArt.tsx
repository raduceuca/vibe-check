import { ArtSvg, INK, FIRE, FIRE_OP, FIRE_FILL } from './artKit'

// layout-thrashing — rows that should align to the left baseline jump off it;
// the shifted rows are the fault accent.
export const LayoutThrashingArt = () => (
  <ArtSvg>
    {/* intended left baseline */}
    <path d="M9 8 V40" strokeOpacity={INK.mid} fill="none" />
    {/* aligned rows */}
    <rect
      x={9}
      y={11}
      width={22}
      height={5}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={9}
      y={27}
      width={18}
      height={5}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* shifted rows (fault) */}
    <rect
      x={16}
      y={19}
      width={22}
      height={5}
      rx={1.5}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
    <rect
      x={14}
      y={35}
      width={24}
      height={5}
      rx={1.5}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
  </ArtSvg>
)
