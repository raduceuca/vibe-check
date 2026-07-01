import type { CSSProperties } from 'react'

interface CopyButtonProps {
  readonly copied: boolean
  readonly onClick: () => void
  readonly size?: 'sm' | 'md'
  readonly label?: string
}

const baseStyle = (size: 'sm' | 'md', copied: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: size === 'sm' ? '5px 9px' : '6px 12px',
  minHeight: size === 'sm' ? 28 : 32,
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  border: `1px solid ${copied ? 'color-mix(in srgb, var(--wcgw-sev-success) 22%, transparent)' : 'var(--wcgw-border)'}`,
  cursor: 'pointer',
  transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  color: copied ? 'var(--wcgw-sev-success)' : 'var(--wcgw-text-secondary)',
  background: copied ? 'color-mix(in srgb, var(--wcgw-sev-success) 8%, transparent)' : 'var(--wcgw-surface)',
  outline: 'none',
  fontFamily: 'inherit',
})

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

  return (
    <button
      style={baseStyle(size, copied)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={copied ? 'Copied!' : (label ?? 'Copy to clipboard')}
      title={copied ? 'Copied!' : (label ?? 'Copy for your AI agent')}
    >
      {copied ? <CheckSVG size={iconSize} /> : <ClipboardSVG size={iconSize} />}
      {label ? label : (copied ? 'copied' : 'copy')}
    </button>
  )
}
