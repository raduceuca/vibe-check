import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'

interface ModeToggleProps {
  readonly mode: SuggestionMode
  readonly onToggle: () => void
}

const trackStyle = (isVibe: boolean): CSSProperties => ({
  position: 'relative',
  width: 36,
  height: 18,
  borderRadius: 9,
  background: isVibe
    ? 'rgba(255,255,255,0.12)'
    : 'rgba(255,255,255,0.06)',
  border: `1px solid rgba(255,255,255,${isVibe ? '0.15' : '0.08'})`,
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  flexShrink: 0,
})

const thumbStyle = (isVibe: boolean): CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: isVibe ? 18 : 2,
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: isVibe ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
  boxShadow: isVibe ? '0 0 6px rgba(255,255,255,0.2)' : 'none',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
})

const containerStyle: CSSProperties = {
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
  color: active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
  transition: 'all 0.3s ease',
})

export const ModeToggle = ({ mode, onToggle }: ModeToggleProps) => {
  const isVibe = mode === 'vibe'

  return (
    <div
      style={containerStyle}
      onClick={onToggle}
      role="switch"
      aria-checked={isVibe}
      aria-label={`Switch to ${isVibe ? 'technical' : 'simple'} mode`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <span style={labelStyle(!isVibe)}>dev</span>
      <div style={trackStyle(isVibe)}>
        <div style={thumbStyle(isVibe)} />
      </div>
      <span style={labelStyle(isVibe)}>vibe</span>
    </div>
  )
}
