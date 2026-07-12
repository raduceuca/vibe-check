import type { CSSProperties } from 'react'

interface CopyButtonProps {
  readonly copied: boolean
  readonly onClick: () => void
  readonly size?: 'sm' | 'md'
  readonly label?: string
}

const baseStyle = (copied: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '6px 12px',
  minHeight: 40,
  borderRadius: 'var(--wcgw-radius-sm)',
  fontSize: 14,
  fontWeight: 500,
  border: `1px solid ${copied ? 'color-mix(in srgb, var(--wcgw-sev-success) 22%, transparent)' : 'var(--wcgw-border)'}`,
  cursor: 'pointer',
  transition: 'background var(--wcgw-duration-normal) var(--wcgw-ease), border-color var(--wcgw-duration-normal) var(--wcgw-ease), color var(--wcgw-duration-normal) var(--wcgw-ease)',
  color: copied ? 'var(--wcgw-sev-success)' : 'var(--wcgw-text-secondary)',
  background: copied ? 'color-mix(in srgb, var(--wcgw-sev-success) 8%, transparent)' : 'var(--wcgw-surface)',
  fontFamily: 'inherit',
})

// Visually-hidden live region: SR users hear the copy succeeded (the visual flip
// to "copied" is silent to them). WCAG 4.1.3 Status Messages.
const SR_STATUS: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

const ClipboardSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M5.5 3A1.5 1.5 0 0 1 7 1.5h2A1.5 1.5 0 0 1 10.5 3M5.5 3H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-1.5M5.5 3h5"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

const CheckSVG = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.5 8.5L6.5 11.5L12.5 4.5"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
)

export const CopyButton = ({ copied, onClick, size = 'sm', label }: CopyButtonProps) => {
  const iconSize = size === 'sm' ? 12 : 14
  // One string for title + aria-label (they used to disagree). Copied state
  // reads "Copied" without an exclamation, matching the lowercase visible label.
  const describe = copied ? 'Copied' : 'Copy prompt for your AI agent'
  // "copy all" buttons announce the batch; single copies announce one prompt.
  const isBatch = /(^|\s)all(\s|$)/i.test(label ?? '')

  return (
    <>
      <button
        style={baseStyle(copied)}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        aria-label={describe}
        title={describe}
      >
        {copied ? <CheckSVG size={iconSize} /> : <ClipboardSVG size={iconSize} />}
        {label ? label : (copied ? 'copied' : 'copy')}
      </button>
      <span role="status" aria-live="polite" style={SR_STATUS}>
        {copied ? (isBatch ? 'All prompts copied' : 'Prompt copied') : ''}
      </span>
    </>
  )
}
