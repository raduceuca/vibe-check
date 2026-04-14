import type { CSSProperties } from 'react'
import type { Severity } from '@wcgw/vibe-check-core'

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string }> = {
  info: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' },
  warning: { color: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
  error: { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.1)' },
  critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
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
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    color: config.color,
    backgroundColor: config.bg,
    lineHeight: 1.4,
  }

  const dotStyle: CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: config.color,
  }

  return (
    <span style={style}>
      <span style={dotStyle} />
      {severity}
    </span>
  )
}
