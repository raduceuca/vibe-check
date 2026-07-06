import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// console-spam — a console whose log rows pile up; the error rows (fault accent,
// each with a leading tick) overflow past the frame.
export const ConsoleSpamArt = () => (
  <ArtSvg>
    {/* console frame */}
    <rect
      x={7}
      y={9}
      width={30}
      height={30}
      rx={3}
      strokeOpacity={INK.mid}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* neutral log rows */}
    <g strokeOpacity={INK.strong} fill="none">
      <path d="M12 16 H28" />
      <path d="M12 24 H24" />
      <path d="M12 32 H26" />
    </g>
    {/* error rows — pile up + overflow, leading tick */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <path d="M12 20 H42" />
      <path d="M12 28 H42" />
    </g>
    <circle cx={9.5} cy={20} r={1.1} fill={FIRE} stroke="none" />
    <circle cx={9.5} cy={28} r={1.1} fill={FIRE} stroke="none" />
  </ArtSvg>
)
