import { ArtSvg } from './artKit'
import { Node, Crosshair, Arc, OP, HAIR, C, pt } from './instrumentKit'

// web-essentials (instrument grammar) — the baseline gauge. A full crosshair
// reticle with end ticks frames a solid gauge arc across the lower dial, with a
// small check where the baseline is met. The core-vitals reference frame every
// page is measured against.
const [chx, chy] = pt(C, C, 13, 58) // check position, inside the gauge

export const WebEssentialsArt = () => (
  <ArtSvg>
    <Crosshair reach={21} gap={4} opacity={OP.line} />
    {/* the baseline gauge */}
    <Arc r={16} a0={140} a1={40} opacity={OP.line} />
    {/* baseline met */}
    <polyline
      points={`${chx - 1.7},${chy - 0.2} ${chx - 0.5},${chy + 1.1} ${chx + 2},${chy - 1.7}`}
      fill="none"
      strokeWidth={HAIR}
      strokeOpacity={OP.line}
    />
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
