import { ArtSvg, INK, FIRE, FIRE_OP, FIRE_FILL } from './artKit'

// long-task-attribution — a main-thread timeline where one long task (fault
// accent) blocks the thread while short tasks wait beside it.
export const LongTaskAttributionArt = () => (
  <ArtSvg>
    {/* main-thread track */}
    <path d="M6 33 H42" strokeOpacity={INK.mid} fill="none" />
    {/* frame ticks */}
    <g strokeOpacity={INK.soft} fill="none">
      <path d="M6 31 V35" />
      <path d="M18 31 V35" />
      <path d="M30 31 V35" />
      <path d="M42 31 V35" />
    </g>
    {/* short tasks */}
    <rect
      x={7}
      y={26}
      width={4}
      height={7}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <rect
      x={12.5}
      y={26}
      width={3.5}
      height={7}
      rx={1}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* long blocking task (fault) */}
    <rect
      x={18}
      y={23}
      width={20}
      height={10}
      rx={1.5}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
  </ArtSvg>
)
