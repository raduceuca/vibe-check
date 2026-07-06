import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// seo — a page inspected for search visibility: a magnifier over a pass/fail
// checklist, the failed check in the fault accent.
export const SeoArt = () => (
  <ArtSvg>
    {/* page */}
    <rect
      x={7}
      y={7}
      width={25}
      height={30}
      rx={3}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* text lines */}
    <g strokeOpacity={INK.mid} fill="none">
      <path d="M11 14 H28" />
      <path d="M11 19 H24" />
    </g>
    {/* pass */}
    <polyline points="11,25 12.4,26.6 15,23.8" strokeOpacity={INK.strong} fill="none" />
    <path d="M18 25 H27" strokeOpacity={INK.mid} fill="none" />
    {/* fail (fault) */}
    <path
      d="M11 30.5 L14 33.5 M14 30.5 L11 33.5"
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill="none"
    />
    <path d="M18 32 H25" stroke={FIRE} strokeOpacity={0.4} fill="none" />
    {/* magnifier */}
    <g strokeOpacity={INK.strong} fill="none">
      <circle cx={31} cy={30} r={6.5} />
      <path d="M35.6 34.6 L41 40" />
    </g>
  </ArtSvg>
)
