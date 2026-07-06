import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// duplicate-requests — one request arrow echoed three times; the two rear copies
// are the duplicates, in the fault accent.
export const DuplicateRequestsArt = () => (
  <ArtSvg>
    {/* echo 2 (rearmost duplicate) */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <path d="M18 16 H37" />
      <polyline points="33,12 37,16 33,20" />
    </g>
    {/* echo 1 (duplicate) */}
    <g stroke={FIRE} strokeOpacity={FIRE_OP} fill="none">
      <path d="M15 24 H34" />
      <polyline points="30,20 34,24 30,28" />
    </g>
    {/* original request */}
    <g strokeOpacity={INK.strong} fill="none">
      <path d="M12 32 H31" />
      <polyline points="27,28 31,32 27,36" />
    </g>
  </ArtSvg>
)
