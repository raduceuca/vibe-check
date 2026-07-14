import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'
import { formatImpactMarkdown } from '../utils/impactExport.js'
import { Button } from './ui/Button.js'

interface ImpactCardProps {
  readonly impact: ProjectImpactSummary
  readonly compact: boolean
  readonly onCopy: (text: string) => void | Promise<unknown>
}

const statStyle = {
  color: T.textSecondary,
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
} as const

export const ImpactCard = ({ impact, compact, onCopy }: ImpactCardProps) => {
  const metrics = compact ? impact.metrics.slice(0, 1) : impact.metrics
  return (
    <section
      aria-label="VibeCheck impact"
      style={{
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: T.radiusMd,
        padding: 12,
        background: T.bgSubtle,
        marginBottom: 12,
      }}
    >
      <div style={{ color: T.text, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Project impact
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <div style={{ ...statStyle, color: T.green }}>{impact.verifiedFixes} verified fixes</div>
        <div style={{ ...statStyle, color: T.yellow }}>{impact.regressionsCaught} regressions caught</div>
      </div>
      {metrics.length > 0 && (
        <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
          {metrics.map((metric) => (
            <div
              key={`${metric.kind}:${metric.confidence}`}
              title={`${metric.scope}; ${metric.confidence}`}
              style={statStyle}
            >
              {metric.value} {metric.label}
              {metric.confidence === 'estimated' ? ' (estimated)' : ''}
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div style={{ marginTop: 10 }}>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            ariaLabel="Copy impact summary"
            onClick={() => { void onCopy(formatImpactMarkdown(impact)) }}
          >
            Copy impact summary
          </Button>
        </div>
      )}
    </section>
  )
}
