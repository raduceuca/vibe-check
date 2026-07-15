import { ArtSvg, ProcessPlate, type ProcessInk } from './artKit'
import { Node, Ray, Ring, OP } from './instrumentKit'

// console-spam (instrument grammar) — a noisy readout: a central dot firing a
// dense fan of short rays at scattered, uneven bearings (several dashed = the
// repeated log noise), a few landing in tiny leaf-dots. One faint ambient ring
// frames the din. Reads as the same log blurted over and over, outward.
interface Burst {
  readonly deg: number
  readonly to: number
  readonly dashed: boolean
  readonly tip?: number
}

const BURSTS: readonly Burst[] = [
  { deg: -82, to: 12, dashed: true, tip: 1 },
  { deg: -38, to: 10, dashed: false },
  { deg: 6, to: 13, dashed: true },
  { deg: 44, to: 9, dashed: false, tip: 1 },
  { deg: 74, to: 12, dashed: true },
  { deg: 112, to: 10, dashed: false },
  { deg: 150, to: 13, dashed: true, tip: 1 },
  { deg: -152, to: 9, dashed: false },
  { deg: -116, to: 11, dashed: true },
]

const PROCESS: readonly ProcessInk[] = ['cyan', 'magenta', 'yellow']

export const ConsoleSpamArt = () => (
  <ArtSvg>
    {/* the din, framed */}
    <Ring r={18} opacity={OP.faint} />
    {/* scattered log noise firing outward */}
    {BURSTS.map((b, index) => (
      <ProcessPlate key={b.deg} ink={PROCESS[index % PROCESS.length] ?? 'cyan'}>
        <Ray
          deg={b.deg}
          from={4}
          to={b.to}
          dashed={b.dashed}
          tip={b.tip}
          opacity={OP.line}
        />
      </ProcessPlate>
    ))}
    <Node shape="dot" r={2.2} />
  </ArtSvg>
)
