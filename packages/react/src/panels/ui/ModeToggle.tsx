import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { T } from '../../tokens.js'
import { Switch } from './Switch.js'

interface ModeToggleProps {
  readonly mode: SuggestionMode
  readonly onToggle: () => void
}

// The two-label variant of Switch (dev ⇄ vibe). Same primitive as the boolean
// ToggleRow, so both switches in Settings share one geometry, duration, and set
// of on/off treatments. The visible dev/vibe words are decorative (aria-hidden);
// the checkbox carries state via `checked`, named by a stable property so screen
// readers announce e.g. "Simple wording, checked" rather than a contradictory
// action + state.
const containerStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  userSelect: 'none',
  padding: '4px 0',
  minHeight: 44,
}

const labelStyle = (active: boolean): CSSProperties => ({
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  color: active ? T.textSecondary : T.textMuted,
  transition: `color ${T.durationNormal} ${T.ease}`,
})

export const ModeToggle = ({ mode, onToggle }: ModeToggleProps) => {
  const isVibe = mode === 'vibe'

  return (
    <label style={containerStyle}>
      <span aria-hidden="true" style={labelStyle(!isVibe)}>dev</span>
      <Switch checked={isVibe} onChange={onToggle} ariaLabel="Simple wording" />
      <span aria-hidden="true" style={labelStyle(isVibe)}>vibe</span>
    </label>
  )
}
