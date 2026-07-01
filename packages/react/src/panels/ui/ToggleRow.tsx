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
  color: 'rgba(var(--wcgw-fg), 0.55)',
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
  backgroundColor: on ? 'rgba(var(--wcgw-fg), 0.2)' : 'rgba(var(--wcgw-fg), 0.08)',
  border: `1px solid ${on ? 'rgba(var(--wcgw-fg), 0.25)' : 'rgba(var(--wcgw-fg), 0.1)'}`,
  cursor: 'pointer',
  transition: 'background-color 0.2s ease, border-color 0.2s ease',
  flexShrink: 0,
})

const thumbStyle = (on: boolean): CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: on ? 16 : 2,
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: on ? 'rgba(var(--wcgw-fg),0.9)' : 'rgba(var(--wcgw-fg), 0.35)',
  boxShadow: on ? '0 0 4px rgba(var(--wcgw-fg),0.2)' : 'none',
  transition: 'left 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
})

export const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => (
  <div style={rowStyle}>
    <span style={{ color: 'rgba(var(--wcgw-fg), 0.55)', fontSize: 14 }}>{label}</span>
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
