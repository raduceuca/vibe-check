import { ArtSvg, ProcessPlate } from './artKit'
import { Node, Ring, Ray, OP } from './instrumentKit'

// resource-bloat (instrument grammar) — too many resources pulled onto one
// horizon. A wide even fan of rays from the centre lands leaf-dots ON a single
// dashed range ring; a faint outer ring sits beyond. Many fetches, all dragged
// up to the same page-weight boundary at once.
const FAN = [-126, -84, -42, 0, 42, 84, 126] // wide, even spread

export const ResourceBloatArt = () => (
  <ArtSvg>
    {/* far horizon */}
    <ProcessPlate ink="cyan">
      <Ring r={21} opacity={OP.faint} />
    </ProcessPlate>
    {/* the weight boundary the resources land on */}
    <ProcessPlate ink="magenta">
      <Ring r={17} opacity={OP.ambient} />
    </ProcessPlate>
    {/* resources pulled onto it */}
    {FAN.map((deg, index) => index % 3 === 0 ? (
      <ProcessPlate key={deg} ink="yellow">
        <Ray deg={deg} from={3} to={17} tip={1.4} opacity={OP.line} />
      </ProcessPlate>
    ) : (
      <Ray key={deg} deg={deg} from={3} to={17} tip={1.4} opacity={OP.line} />
    ))}
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
