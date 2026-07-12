import { ArtSvg } from './artKit'
import { Node, Crosshair, OP, HAIR, C, pt } from './instrumentKit'

// layout-thrashing (instrument grammar) — the reticle jumps. A faint ghost
// reading (offset crosshair + square) sits down-right of the true one; a short
// arrow snaps from the ghost back to the solid node. The doubled, misregistered
// crosshair reads as content shifting under you (CLS).
const OFF_X = 5.5
const OFF_Y = 4.5
const GX = C + OFF_X // ghost centre
const GY = C + OFF_Y

// arrow: ghost → solid (the snap into place)
const DIR = (Math.atan2(C - GY, C - GX) * 180) / Math.PI
const [ax0, ay0] = pt(GX, GY, 2.4, DIR) // start just off the ghost
const [ax1, ay1] = pt(GX, GY, 4.6, DIR) // tip, short of the solid node
const [hb1x, hb1y] = pt(ax1, ay1, 2.6, DIR + 150)
const [hb2x, hb2y] = pt(ax1, ay1, 2.6, DIR - 150)

export const LayoutThrashingArt = () => (
  <ArtSvg>
    {/* ghost reading — where it was */}
    <Crosshair cx={GX} cy={GY} reach={13} gap={3.5} ticks={false} opacity={OP.faint} />
    <rect
      x={GX - 2.4}
      y={GY - 2.4}
      width={4.8}
      height={4.8}
      rx={0.6}
      fill="currentColor"
      fillOpacity={OP.faint}
      stroke="none"
    />
    {/* true reading — where it snapped to */}
    <Crosshair reach={13} gap={3.5} opacity={OP.line} />
    {/* the jump */}
    <g fill="none" strokeWidth={HAIR} strokeOpacity={OP.line}>
      <line x1={ax0} y1={ay0} x2={ax1} y2={ay1} />
      <polyline points={`${hb1x},${hb1y} ${ax1},${ay1} ${hb2x},${hb2y}`} />
    </g>
    <Node shape="square" r={2.4} />
  </ArtSvg>
)
