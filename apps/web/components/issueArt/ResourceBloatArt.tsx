import { ArtSvg } from './artKit'
import { Node, Ring, Ray, OP } from './instrumentKit'

// resource-bloat (instrument grammar) — too many resources pulled onto one
// horizon. A wide even fan of rays from the centre lands leaf-dots ON a single
// dashed range ring; a faint outer ring sits beyond. Many fetches, all dragged
// up to the same page-weight boundary at once.
const FAN = [-126, -84, -42, 0, 42, 84, 126] // wide, even spread

export const ResourceBloatArt = () => (
  <ArtSvg>
    {/* far horizon */}
    <Ring r={21} opacity={OP.faint} />
    {/* the weight boundary the resources land on */}
    <Ring r={17} opacity={OP.ambient} />
    {/* resources pulled onto it */}
    {FAN.map((deg) => (
      <Ray key={deg} deg={deg} from={3} to={17} tip={1.4} opacity={OP.line} />
    ))}
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
