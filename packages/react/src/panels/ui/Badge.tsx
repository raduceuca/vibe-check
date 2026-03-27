import type { CSSProperties } from 'react'
import type { Severity } from '@wcgw/vibe-check-core'

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; glow: string }> = {
  info: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', glow: 'rgba(96, 165, 250, 0.15)' },
  warning: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', glow: 'rgba(251, 191, 36, 0.15)' },
  error: { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', glow: 'rgba(251, 146, 60, 0.15)' },
  critical: { color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', glow: 'rgba(248, 113, 113, 0.2)' },
}

interface BadgeProps {
  readonly severity: Severity
}

export const Badge = ({ severity }: BadgeProps) => {
  const config = SEVERITY_CONFIG[severity]
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 6px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: config.color,
    backgroundColor: config.bg,
    boxShadow: `0 0 6px ${config.glow}`,
    lineHeight: 1.6,
  }

  const dotStyle: CSSProperties = {
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: config.color,
    boxShadow: `0 0 4px ${config.color}`,
  }

  return (
    <span style={style}>
      <span style={dotStyle} />
      {severity}
    </span>
  )
}
