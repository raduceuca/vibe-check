import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// memory-leak — heap only ever climbs: a monotonic rising line (fault accent)
// that never drains, ending in an up-arrow.
export const MemoryLeakArt = () => (
  <ArtSvg>
    {/* axes */}
    <path d="M11 8 V40 H42" strokeOpacity={INK.mid} fill="none" />
    {/* ever-rising heap */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <polyline points="11,38 18,33 25,29 31,23 36,18 39,12" />
      <polyline points="36,15 39,12 42,15" />
    </g>
  </ArtSvg>
)
