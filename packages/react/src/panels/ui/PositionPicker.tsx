import { useId, useState, type CSSProperties } from 'react'
import type { Position } from '../types.js'
import { T } from '../../tokens.js'

interface PositionPickerProps {
  readonly label: string
  readonly value: Position
  readonly onChange: (value: Position) => void
}

const OPTIONS: readonly { readonly value: Position; readonly label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
]

const markerPosition: Readonly<Record<Position, CSSProperties>> = {
  'top-left': { top: 4, left: 4 },
  'top-right': { top: 4, right: 4 },
  'bottom-left': { bottom: 4, left: 4 },
  'bottom-right': { right: 4, bottom: 4 },
}

export const PositionPicker = ({ label, value, onChange }: PositionPickerProps) => {
  const name = useId()
  const [focused, setFocused] = useState<Position | null>(null)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 7,
        padding: 8,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: T.radiusMd,
        background: T.bg,
      }}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.value
        const hasFocus = focused === option.value
        return (
          <label
            key={option.value}
            style={{
              position: 'relative',
              minHeight: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: T.radiusSm,
              border: `1px solid ${selected ? T.green : T.borderSubtle}`,
              background: selected ? T.bgHover : T.bgSubtle,
              color: selected ? T.green : T.textTertiary,
              boxShadow: hasFocus ? `0 0 0 2px ${T.blue}` : 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: selected ? 650 : 500,
              transition: `border-color ${T.durationFast} ${T.ease}, box-shadow ${T.durationFast} ${T.ease}`,
            }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              aria-label={option.label}
              onChange={() => onChange(option.value)}
              onFocus={() => setFocused(option.value)}
              onBlur={() => setFocused(null)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'relative',
                width: 20,
                height: 16,
                border: `1px solid ${selected ? T.green : T.border}`,
                borderRadius: T.radiusXs,
              }}
            >
              <span style={{
                position: 'absolute',
                width: 5,
                height: 5,
                borderRadius: T.radiusPill,
                background: selected ? T.green : T.textMuted,
                ...markerPosition[option.value],
              }} />
            </span>
            <span>{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
