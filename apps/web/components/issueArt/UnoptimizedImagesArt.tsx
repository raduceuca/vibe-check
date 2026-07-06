import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// unoptimized-images — a huge source frame (dashed, fault accent) collapsed into
// a small display frame: served far larger than it renders.
export const UnoptimizedImagesArt = () => (
  <ArtSvg>
    {/* oversized source */}
    <rect
      x={7}
      y={7}
      width={34}
      height={30}
      rx={3}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      strokeDasharray="3 3"
      fill="none"
    />
    {/* small display frame */}
    <rect
      x={18}
      y={19}
      width={17}
      height={14}
      rx={2}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* image glyph: sun + mountains */}
    <circle cx={22} cy={23} r={1.6} strokeOpacity={INK.strong} fill="none" />
    <polyline
      points="19,32 23,27 26,30 31,25 34,30"
      strokeOpacity={INK.mid}
      fill="none"
    />
    {/* squeeze brackets (fault) */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <polyline points="12,12 16,12 16,16" />
      <polyline points="36,12 32,12 32,16" />
    </g>
  </ArtSvg>
)
