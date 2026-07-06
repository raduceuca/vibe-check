import { ArtSvg, INK, FIRE, FIRE_OP } from './artKit'

// aeo — a page read by an answer engine: a small robot inspects a pass/fail
// checklist (sibling to the seo magnifier), the failed check in the fault accent.
export const AeoArt = () => (
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
    {/* answer-engine robot */}
    <g strokeOpacity={INK.strong} fill="none">
      <path d="M34 24 V20.5" />
      <rect x={28} y={24} width={13} height={11} rx={3} />
    </g>
    <circle cx={34} cy={19.5} r={1.1} fill="currentColor" fillOpacity={INK.strong} stroke="none" />
    <circle cx={32} cy={29.5} r={1.1} fill="currentColor" fillOpacity={INK.strong} stroke="none" />
    <circle cx={37} cy={29.5} r={1.1} fill="currentColor" fillOpacity={INK.strong} stroke="none" />
  </ArtSvg>
)
