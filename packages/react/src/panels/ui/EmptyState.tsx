import { T } from '../../tokens.js'

// The "all clear / nothing here" line shared by the audit and agent panels:
// an optional breathing success dot next to a muted label.
interface EmptyStateProps {
  readonly label: string
  readonly showDot?: boolean
}

export const EmptyState = ({ label, showDot = true }: EmptyStateProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
    {showDot && (
      <span data-wcgw-breathe style={{
        width: 7,
        height: 7,
        borderRadius: T.radiusPill,
        background: T.green,
        animation: 'vc-breathe 3s ease-in-out infinite',
      }} />
    )}
    <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>{label}</span>
  </div>
)
