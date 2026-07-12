import type { Severity } from '@wcgw/vibe-check-core'

// Severity → theme-tuned CSS variable (bright on dark, dark+saturated on light)
// so the indicator stays legible in both themes.
const SEV_VAR: Record<Severity, string> = {
  info: 'var(--wcgw-sev-info)',
  warning: 'var(--wcgw-sev-warning)',
  error: 'var(--wcgw-sev-error)',
  critical: 'var(--wcgw-sev-critical)',
}

interface SeverityDotProps {
  readonly severity: Severity
}

// Collapsed severity indicator — a colour-coded dot for dense one-line rows.
// role="img" is required for the aria-label to be announced (a bare <span> is a
// generic role that prohibits accessible names, so most SRs drop it).
export const SeverityDot = ({ severity }: SeverityDotProps) => (
  <span
    role="img"
    aria-label={`severity: ${severity}`}
    title={severity}
    style={{
      width: 9,
      height: 9,
      borderRadius: '50%',
      flexShrink: 0,
      backgroundColor: SEV_VAR[severity],
    }}
  />
)
