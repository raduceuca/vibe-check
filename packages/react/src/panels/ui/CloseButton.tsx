import { T } from '../../tokens.js'

// Small SVG close control for dismissable surfaces (the annotation popover, and
// any future dismissable). Replaces hand-rolled unicode-glyph "×" buttons so the
// icon weight/size matches Chevron/CopyButton.
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

interface CloseButtonProps {
  readonly onClick: () => void
  readonly ariaLabel?: string
}

export const CloseButton = ({ onClick, ariaLabel = 'Close' }: CloseButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      padding: 0,
      borderRadius: T.radiusSm,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: T.textTertiary,
      fontFamily: 'inherit',
    }}
  >
    <XIcon />
  </button>
)
