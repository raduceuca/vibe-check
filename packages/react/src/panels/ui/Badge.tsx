import type { CSSProperties } from 'react'
import type { Severity } from '@wcgw/vibe-check-core'

// Severity → theme-tuned CSS variable (bright on dark, dark+saturated on light)
// so badge text stays legible in both themes, with a color-mix tint background
// instead of a near-invisible fixed alpha.
const SEV_VAR: Record<Severity, string> = {
  info: 'var(--vc-sev-info, #60a5fa)',
  warning: 'var(--vc-sev-warning, #facc15)',
  error: 'var(--vc-sev-error, #fb923c)',
  critical: 'var(--vc-sev-critical, #f87171)',
}

interface BadgeProps {
  readonly severity: Severity
}

export const Badge = ({ severity }: BadgeProps) => {
  const c = SEV_VAR[severity]
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: c,
    backgroundColor: `color-mix(in srgb, ${c} var(--vc-badge-alpha, 14%), transparent)`,
    lineHeight: 1.4,
  }

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    backgroundColor: c,
  }

  return (
    <span style={style}>
      <span style={dotStyle} />
      {severity}
    </span>
  )
}
