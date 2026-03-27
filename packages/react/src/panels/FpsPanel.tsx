import type { CSSProperties } from 'react'
import type { FrameRateStats } from '@wcgw/vibe-check-core'
import { Panel } from './ui/Panel.js'
import { Row } from './ui/Row.js'

interface FpsPanelProps {
  readonly stats: FrameRateStats
}

const fpsColor = (fps: number): string => {
  if (fps >= 55) return '#4ade80'
  if (fps >= 40) return '#fbbf24'
  if (fps >= 25) return '#fb923c'
  return '#f87171'
}

const smoothnessColor = (smoothness: number): string => {
  if (smoothness >= 95) return '#4ade80'
  if (smoothness >= 80) return '#fbbf24'
  if (smoothness >= 60) return '#fb923c'
  return '#f87171'
}

const frameTimeColor = (ms: number): string => {
  if (ms <= 16.67) return '#4ade80'
  if (ms <= 33.33) return '#fbbf24'
  if (ms <= 50) return '#fb923c'
  return '#f87171'
}

const heroStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 4,
  marginBottom: 4,
}

const heroValueStyle = (color: string): CSSProperties => ({
  fontSize: 22,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color,
  textShadow: `0 0 12px ${color}40`,
  lineHeight: 1,
  letterSpacing: '-0.02em',
})

const heroUnitStyle: CSSProperties = {
  fontSize: 10,
  color: 'rgba(255, 255, 255, 0.3)',
  fontWeight: 500,
}

export const FpsPanel = ({ stats }: FpsPanelProps) => {
  const color = fpsColor(stats.fps)
  return (
    <Panel>
      <div style={heroStyle}>
        <span style={heroValueStyle(color)}>{Math.round(stats.fps)}</span>
        <span style={heroUnitStyle}>fps</span>
      </div>
      <Row
        label="Frame time"
        value={`${stats.avgFrameTime.toFixed(1)}ms`}
        color={frameTimeColor(stats.avgFrameTime)}
      />
      <Row
        label="Worst"
        value={`${stats.maxFrameTime.toFixed(1)}ms`}
        color={frameTimeColor(stats.maxFrameTime)}
      />
      <Row
        label="Smooth"
        value={`${stats.smoothness.toFixed(0)}%`}
        color={smoothnessColor(stats.smoothness)}
      />
      {stats.droppedFrames > 0 && (
        <Row
          label="Dropped"
          value={stats.droppedFrames}
          color="#fb923c"
        />
      )}
    </Panel>
  )
}
