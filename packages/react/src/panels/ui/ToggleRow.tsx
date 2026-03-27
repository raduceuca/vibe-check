import type { CSSProperties } from 'react'

interface ToggleRowProps {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 11,
}

const labelStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.45)',
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const trackStyle = (on: boolean): CSSProperties => ({
  position: 'relative',
  width: 28,
  height: 14,
  borderRadius: 7,
  backgroundColor: on ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.1)',
  border: `1px solid ${on ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 255, 255, 0.12)'}`,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  flexShrink: 0,
})

const thumbStyle = (on: boolean): CSSProperties => ({
  position: 'absolute',
  top: 1,
  left: on ? 14 : 1,
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: on ? '#4ade80' : 'rgba(255, 255, 255, 0.4)',
  boxShadow: on ? '0 0 4px rgba(74, 222, 128, 0.4)' : 'none',
  transition: 'all 0.2s ease',
})

export const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => (
  <div style={rowStyle}>
    <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>{label}</span>
    <label style={labelStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        aria-label={label}
      />
      <div style={trackStyle(checked)}>
        <div style={thumbStyle(checked)} />
      </div>
    </label>
  </div>
)
