import type { ReactNode } from 'react'
import { T } from '../../tokens.js'
import { T_VALUE, STAT_LABEL } from './typography.js'

// Compact metric — value over a small uppercase label, aligned to a grid.
// Promoted from VibeCheck's MiniMetric so any panel can use it.
interface StatProps {
  readonly label: string
  readonly value: ReactNode
  readonly color?: string
}

export const Stat = ({ label, value, color }: StatProps) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...T_VALUE, color: color ?? T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    <div style={STAT_LABEL}>{label}</div>
  </div>
)
