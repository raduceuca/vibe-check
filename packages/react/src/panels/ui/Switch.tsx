import type { CSSProperties, ReactNode } from 'react'

// ── The one switch primitive ─────────────────────────────────────────────────
// A visually-hidden checkbox drives a track + thumb. ToggleRow (single boolean)
// and ModeToggle (two-label) both build on it, so there is exactly one geometry,
// one duration, and one set of on/off treatments.
//
// State legibility (works in BOTH themes because --wcgw-fg flips):
//   ON  — track filled at fg/0.85, thumb = --wcgw-elevated (near-white on light,
//         near-black on dark) so it reads as a punched hole in a filled track.
//   OFF — faint track, thumb at fg/0.55 (a mid grey that clears 3:1 vs the track).
// This fixes the light-mode "empty grey lozenge" where state was carried only by
// a tiny knob's shade.

const TRACK_W = 34
const TRACK_H = 18
const THUMB = 14
const PAD = 2

const trackStyle = (on: boolean): CSSProperties => ({
  position: 'relative',
  width: TRACK_W,
  height: TRACK_H,
  borderRadius: 'var(--wcgw-radius-pill)',
  background: on ? 'rgba(var(--wcgw-fg),0.85)' : 'rgba(var(--wcgw-fg),0.10)',
  border: `1px solid rgba(var(--wcgw-fg),${on ? '0.85' : '0.12'})`,
  boxSizing: 'border-box',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color var(--wcgw-duration-normal) var(--wcgw-ease), border-color var(--wcgw-duration-normal) var(--wcgw-ease)',
})

const thumbStyle = (on: boolean): CSSProperties => ({
  position: 'absolute',
  top: PAD - 1,
  left: on ? TRACK_W - THUMB - PAD - 1 : PAD - 1,
  width: THUMB,
  height: THUMB,
  borderRadius: '50%',
  background: on ? 'var(--wcgw-elevated)' : 'rgba(var(--wcgw-fg),0.55)',
  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
  transition: 'left var(--wcgw-duration-normal) var(--wcgw-ease), background-color var(--wcgw-duration-normal) var(--wcgw-ease), box-shadow var(--wcgw-duration-normal) var(--wcgw-ease)',
})

interface SwitchProps {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  // Accessible name for the checkbox. Omit when a wrapping <label> already names
  // it (state is always carried by the checkbox's checked value, not the name).
  readonly ariaLabel?: string
}

// Renders <input> immediately followed by the track <div> so the shared
// `[data-wcgw] input:focus-visible + div` rule projects the focus ring onto the
// track. Must sit inside a positioned ancestor (the wrapping <label>) so the
// absolutely-positioned input anchors correctly.
export const Switch = ({ checked, onChange, ariaLabel }: SwitchProps): ReactNode => (
  <>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      style={{ position: 'absolute', opacity: 0, width: 0, height: 0, margin: 0 }}
    />
    <div style={trackStyle(checked)}>
      <div style={thumbStyle(checked)} />
    </div>
  </>
)
