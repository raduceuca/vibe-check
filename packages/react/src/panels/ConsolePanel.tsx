import type { CSSProperties } from 'react'
import type { ConsoleStats } from '@wcgw/vibe-check-core'
import { Panel } from './ui/Panel.js'

interface ConsolePanelProps {
  readonly stats: ConsoleStats
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 0',
  fontSize: 11,
}

const dotStyle = (color: string): CSSProperties => ({
  width: 5,
  height: 5,
  borderRadius: '50%',
  backgroundColor: color,
  opacity: 0.7,
  flexShrink: 0,
})

const labelStyle: CSSProperties = {
  color: 'rgba(var(--vc-fg,255,255,255), 0.45)',
  flex: 1,
}

const countStyle = (count: number, color: string): CSSProperties => ({
  fontVariantNumeric: 'tabular-nums',
  fontWeight: count > 0 ? 500 : 400,
  color: count > 0 ? color : 'rgba(var(--vc-fg,255,255,255), 0.2)',
  minWidth: 24,
  textAlign: 'right',
})

const ConsoleRow = ({ label, count, color }: { label: string; count: number; color: string }) => (
  <div style={rowStyle}>
    <span style={dotStyle(count > 0 ? color : 'rgba(var(--vc-fg,255,255,255),0.15)')} />
    <span style={labelStyle}>{label}</span>
    <span style={countStyle(count, color)}>{count}</span>
  </div>
)

export const ConsolePanel = ({ stats }: ConsolePanelProps) => (
  <Panel title="Console" borderTop>
    <ConsoleRow label="Logs" count={stats.logCount} color="rgba(var(--vc-fg,255,255,255),0.5)" />
    <ConsoleRow label="Warnings" count={stats.warnCount} color="#fbbf24" />
    <ConsoleRow label="Errors" count={stats.errorCount} color="#f87171" />
  </Panel>
)
