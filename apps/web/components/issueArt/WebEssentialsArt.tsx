import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// web-essentials — a document whose required meta slots are half missing; the
// empty slots (fault accent) sit where a check should be.
export const WebEssentialsArt = () => (
  <ArtSvg>
    {/* page */}
    <rect
      x={11}
      y={7}
      width={26}
      height={34}
      rx={3}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* present: check + line */}
    <g fill="none">
      <polyline points="15,15 16.5,16.6 19,13.8" strokeOpacity={INK.strong} />
      <path d="M22 15 H32" strokeOpacity={INK.mid} />
      <polyline points="15,28 16.5,29.6 19,26.8" strokeOpacity={INK.strong} />
      <path d="M22 28 H32" strokeOpacity={INK.mid} />
    </g>
    {/* missing: empty slot (fault) + dashed placeholder */}
    <g fill="none">
      <rect
        x={14.5}
        y={20}
        width={4}
        height={4}
        rx={1}
        stroke={FIRE}
        strokeOpacity={FIRE_OP}
      />
      <path d="M22 22 H30" stroke={FIRE} strokeOpacity={0.85} strokeDasharray="2.5 2.5" />
      <rect
        x={14.5}
        y={33}
        width={4}
        height={4}
        rx={1}
        stroke={FIRE}
        strokeOpacity={FIRE_OP}
      />
      <path d="M22 35 H30" stroke={FIRE} strokeOpacity={0.85} strokeDasharray="2.5 2.5" />
    </g>
  </ArtSvg>
)
