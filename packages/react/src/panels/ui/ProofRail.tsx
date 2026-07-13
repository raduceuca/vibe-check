import { memo } from 'react'
import { T } from '../../tokens.js'

interface ProofRailProps {
  readonly faulted?: boolean
  readonly compact?: boolean
}

const INKS = [
  ['c', T.proofC],
  ['m', T.proofM],
  ['y', T.proofY],
  ['k', T.proofK],
] as const

// A print-control signature rather than a status meter: the plates are perfectly
// registered at rest and drift by a fraction of a pixel when an issue is active.
export const ProofRail = memo(({ faulted = false, compact = false }: ProofRailProps) => (
  <span
    aria-hidden="true"
    data-testid="wcgw-proof-rail"
    data-wcgw-proof-rail
    data-faulted={faulted ? 'true' : undefined}
    style={{
      display: 'inline-flex',
      width: compact ? 22 : 34,
      height: 2,
      gap: 1,
      flexShrink: 0,
      pointerEvents: 'none',
    }}
  >
    {INKS.map(([ink, color]) => (
      <span
        key={ink}
        data-wcgw-proof-segment={ink}
        style={{ display: 'block', flex: 1, minWidth: 0, background: color }}
      />
    ))}
  </span>
))
