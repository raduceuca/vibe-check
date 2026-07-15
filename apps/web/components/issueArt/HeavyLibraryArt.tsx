import { ArtSvg, ProcessPlate, type ProcessInk } from './artKit'
import { Node, Ray, OP } from './instrumentKit'

// heavy-library (instrument grammar) — one dependency dwarfing the rest. The
// centre node reaches out to a single oversized square node on the right, while
// three stubby rays reach tiny normal leaf-dots for scale. One import that
// weighs as much as everything else combined.
const SMALL = [-140, 140, 180] // the normal, tiny deps
const PROCESS: readonly ProcessInk[] = ['cyan', 'magenta', 'yellow']

export const HeavyLibraryArt = () => (
  <ArtSvg>
    {/* the small, ordinary dependencies */}
    {SMALL.map((deg, index) => (
      <ProcessPlate key={deg} ink={PROCESS[index] ?? 'cyan'}>
        <Ray deg={deg} from={3} to={8.5} tip={1} opacity={OP.line} />
      </ProcessPlate>
    ))}
    {/* the one huge dependency */}
    <Ray deg={0} from={4} to={9} opacity={OP.line} />
    <Node shape="square" cx={38} cy={24} r={4.8} />
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
