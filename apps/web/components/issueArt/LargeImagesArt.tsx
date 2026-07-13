import { ArtSvg, ProcessPlate } from './artKit'
import { Node, Ring, Ray, OP } from './instrumentKit'

// large-images (instrument grammar) — raw byte weight. A big solid node ringed
// by heavy SOLID concentric rings (mass, not structure) with a plumb-line weight
// hanging straight down to a leaf-dot. Distinct from unoptimized: this is sheer
// heft on the wire, no resize would help — the file is simply too big.
export const LargeImagesArt = () => (
  <ArtSvg>
    {/* heft */}
    <ProcessPlate ink="magenta">
      <Ring r={9.5} dashed={false} opacity={OP.line} />
    </ProcessPlate>
    <ProcessPlate ink="cyan">
      <Ring r={14} dashed={false} opacity={OP.line} />
    </ProcessPlate>
    {/* weight pulling down */}
    <ProcessPlate ink="yellow">
      <Ray deg={90} from={6} to={22} tip={1.8} opacity={OP.line} />
    </ProcessPlate>
    <Node shape="square" r={4.5} />
  </ArtSvg>
)
