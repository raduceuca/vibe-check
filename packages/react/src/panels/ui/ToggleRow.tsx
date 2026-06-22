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
  padding: '5px 0',
  fontSize: 14,
}

const labelStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.55)',
  cursor: 'pointer',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 44,
  minWidth: 44,
}

const trackStyle = (on: boolean): CSSProperties => ({
  position: 'relative',
  width: 32,
  height: 16,
  borderRadius: 8,
  backgroundColor: on ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
  border: `1px solid ${on ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)'}`,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  flexShrink: 0,
})

const thumbStyle = (on: boolean): CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: on ? 16 : 2,
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: on ? 'rgba(var(--vc-fg,255,255,255),0.9)' : 'rgba(255, 255, 255, 0.35)',
  boxShadow: on ? '0 0 4px rgba(var(--vc-fg,255,255,255),0.2)' : 'none',
  transition: 'all 0.2s ease',
})

export const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => (
  <div style={rowStyle}>
    <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 14 }}>{label}</span>
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
