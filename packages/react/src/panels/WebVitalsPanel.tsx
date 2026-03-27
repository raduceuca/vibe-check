import type { CSSProperties } from 'react'
import type { WebVitalsStats, VitalRating } from '@wcgw/vibe-check-core'
import { Panel } from './ui/Panel.js'
import { Row } from './ui/Row.js'

interface WebVitalsPanelProps {
  readonly stats: WebVitalsStats
}

const RATING_COLORS: Record<VitalRating, string> = {
  good: '#4ade80',
  'needs-improvement': '#fbbf24',
  poor: '#f87171',
}

const pendingRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 11,
}

const pendingValueStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.18)',
  minWidth: 60,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const formatMs = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

const formatCLS = (value: number): string => value.toFixed(3)

export const WebVitalsPanel = ({ stats }: WebVitalsPanelProps) => (
  <Panel title="Web Vitals" borderTop>
    {stats.lcp ? (
      <Row label="LCP" value={formatMs(stats.lcp.value)} color={RATING_COLORS[stats.lcp.rating]} bold />
    ) : (
      <div style={pendingRowStyle}>
        <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>LCP</span>
        <span style={pendingValueStyle}>--</span>
      </div>
    )}
    {stats.inp ? (
      <Row label="INP" value={formatMs(stats.inp.value)} color={RATING_COLORS[stats.inp.rating]} bold />
    ) : (
      <div style={pendingRowStyle}>
        <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>INP</span>
        <span style={pendingValueStyle}>--</span>
      </div>
    )}
    {stats.cls ? (
      <Row label="CLS" value={formatCLS(stats.cls.value)} color={RATING_COLORS[stats.cls.rating]} bold />
    ) : (
      <div style={pendingRowStyle}>
        <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>CLS</span>
        <span style={pendingValueStyle}>--</span>
      </div>
    )}
  </Panel>
)
