import type { CSSProperties, ReactNode } from 'react'
import { T } from '../../tokens.js'

// Quiet inline text button — the "fix with AI →" / "+N more →" affordance on the
// Monitor tab. A control primitive, so it lives in the ui kit rather than in the
// type-scale module (was QUIET_LINK in typography.ts). Hover/press come from the
// global [data-wcgw] button rules; focus from the shared focus-visible rule.
const linkButtonStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: T.textSecondary,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '4px 2px',
  minHeight: 40,
  transition: `color ${T.durationNormal} ${T.ease}, scale ${T.durationFast} ${T.ease}`,
}

interface LinkButtonProps {
  readonly children: ReactNode
  readonly onClick: () => void
  readonly style?: CSSProperties
}

export const LinkButton = ({ children, onClick, style }: LinkButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    style={style ? { ...linkButtonStyle, ...style } : linkButtonStyle}
  >
    {children}
  </button>
)
