import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// large-images — a single image tile made heavy: a fault-accent weight drags it
// down.
export const LargeImagesArt = () => (
  <ArtSvg>
    {/* image tile */}
    <rect
      x={9}
      y={8}
      width={30}
      height={21}
      rx={2.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    <circle cx={15} cy={14} r={2} strokeOpacity={INK.strong} fill="none" />
    <polyline
      points="11,27 18,19 23,24 30,16 37,27"
      strokeOpacity={INK.mid}
      fill="none"
    />
    {/* weight pulling down (fault) */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <path d="M24 30 V39" />
      <polyline points="20,35 24,40 28,35" />
      <path d="M17 43 H31" />
    </g>
  </ArtSvg>
)
