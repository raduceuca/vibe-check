import { ArtSvg, INK, FIRE, FIRE_OP, FIRE_FILL } from './artKit'

// heavy-library — a heavy dependency crate (fault accent) tips a balance beam,
// dwarfing a light module on the other side.
export const HeavyLibraryArt = () => (
  <ArtSvg>
    {/* beam, tilted down under the heavy side */}
    <path d="M8 39 L40 25" strokeOpacity={INK.strong} fill="none" />
    {/* fulcrum */}
    <path
      d="M24 32 L20 42 H28 Z"
      strokeOpacity={INK.mid}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* light module (right, riding up) */}
    <rect
      x={33}
      y={17}
      width={8}
      height={8}
      rx={1.5}
      strokeOpacity={INK.strong}
      fill="currentColor"
      fillOpacity={INK.fill}
    />
    {/* heavy crate (fault, left, weighing down) */}
    <rect
      x={5}
      y={26}
      width={13}
      height={13}
      rx={1.5}
      stroke={FIRE}
      strokeOpacity={FIRE_OP}
      fill={FIRE}
      fillOpacity={FIRE_FILL}
    />
    <path
      d="M5 26 L18 39 M18 26 L5 39"
      stroke={FIRE}
      strokeOpacity={0.5}
      fill="none"
    />
  </ArtSvg>
)
