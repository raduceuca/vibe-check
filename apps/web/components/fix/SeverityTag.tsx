import type { Severity } from '@/lib/problems/types'

// Severity chip. Colour is reserved for a caught fault: error/critical → the
// signal red, warning → amber, info → neutral. Mirrors the widget's severity
// tokens so the site and the instrument read as one system.

const LABELS: Record<Severity, string> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'critical',
}

export const SeverityTag = ({ severity }: { severity: Severity }) => (
  <span className="vc-sev" data-sev={severity}>
    <span className="vc-sev-dot" aria-hidden="true" />
    {LABELS[severity]}
  </span>
)
