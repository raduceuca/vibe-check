import type { CSSProperties } from 'react'

interface RowProps {
  readonly label: string
  readonly value: string | number
  readonly color: string
  readonly bold?: boolean
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 11,
  lineHeight: 1.4,
}

const labelStyle: CSSProperties = {
  color: 'rgba(var(--vc-fg,255,255,255), 0.45)',
  fontSize: 11,
  letterSpacing: '0.01em',
}

const valueStyle = (color: string, bold?: boolean): CSSProperties => ({
  color,
  fontWeight: bold ? 600 : 400,
  fontVariantNumeric: 'tabular-nums',
  minWidth: 60,
  textAlign: 'right',
  fontSize: bold ? 12 : 11,
  textShadow: bold ? `0 0 8px ${color}33` : 'none',
})

export const Row = ({ label, value, color, bold }: RowProps) => (
  <div style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <span style={valueStyle(color, bold)}>{value}</span>
  </div>
)
