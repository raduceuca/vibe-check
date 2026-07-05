import type { CSSProperties } from 'react'
import { T } from '../../tokens.js'
import { Switch } from './Switch.js'

interface ToggleRowProps {
  readonly label: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}

// The whole row is the <label>, so its text names the checkbox (no duplicated
// aria-label) and clicking anywhere on the 44px band toggles it. position:
// relative anchors Switch's absolutely-positioned hidden input.
const rowStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  minHeight: 44,
  padding: '5px 0',
  fontSize: 14,
  cursor: 'pointer',
  userSelect: 'none',
}

const labelStyle: CSSProperties = {
  color: T.textSecondary,
  fontSize: 14,
}

export const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => (
  <label style={rowStyle}>
    <span style={labelStyle}>{label}</span>
    <Switch checked={checked} onChange={onChange} />
  </label>
)
