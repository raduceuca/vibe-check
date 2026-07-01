import type { CSSProperties, ReactNode } from 'react'
import { T } from '../../tokens.js'

// The single uppercase section label used across every panel — replaces the
// three prior variants (tokens.sectionHeaderStyle, VibeCheck's KICKER, and the
// inline copies). Optional count pill and a right-aligned action slot.
// Exported so bespoke headers (e.g. the audit score header) can reuse the exact
// label treatment without the flex wrapper.
export const sectionLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: T.textTertiary,
}

interface SectionHeaderProps {
  readonly children: ReactNode
  readonly count?: number
  readonly action?: ReactNode
  readonly marginBottom?: number
}

export const SectionHeader = ({ children, count, action, marginBottom = 8 }: SectionHeaderProps) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom,
    minHeight: action ? 32 : undefined,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={sectionLabelStyle}>{children}</span>
      {count != null && count > 0 && (
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: T.text,
          background: T.bgHover,
          padding: '2px 7px',
          borderRadius: T.radiusSm,
        }}>{count}</span>
      )}
    </div>
    {action}
  </div>
)
