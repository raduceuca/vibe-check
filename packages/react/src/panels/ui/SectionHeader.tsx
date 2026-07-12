import type { CSSProperties, ReactNode } from 'react'
import { T } from '../../tokens.js'
import { T_LABEL } from './typography.js'

// The single uppercase section label used across every panel. Aliases T_LABEL
// (the one uppercase-label treatment, 0.04em tracking) so Monitor's KICKER and
// every other tab's section headers can no longer track differently. Exported so
// bespoke headers (e.g. the audit score header) can reuse the exact treatment.
export const sectionLabelStyle: CSSProperties = T_LABEL

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
