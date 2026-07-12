import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { T } from '../../tokens.js'

// The one button in the widget. Hover (background) and press (scale 0.96) come
// from the global [data-wcgw] button rules, so variants only own border/bg/text.
type ButtonVariant = 'ghost' | 'success' | 'danger'
type ButtonSize = 'sm' | 'md'

// Tint a severity token into a faint fill/border via color-mix (keeps everything
// theme-tuned — no hardcoded rgba).
const tint = (token: string, pct: number): string =>
  `color-mix(in srgb, ${token} ${pct}%, transparent)`

const VARIANT: Record<ButtonVariant, CSSProperties> = {
  ghost: { border: `1px solid ${T.border}`, background: T.bgSubtle, color: T.textSecondary },
  success: { border: `1px solid ${tint(T.green, 22)}`, background: tint(T.green, 8), color: T.green },
  danger: { border: `1px solid ${tint(T.red, 22)}`, background: tint(T.red, 8), color: T.red },
}

const SIZE: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '6px 10px', minHeight: 40 },
  md: { padding: '9px 12px', minHeight: 40 },
}

interface ButtonProps {
  readonly children: ReactNode
  readonly onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  readonly variant?: ButtonVariant
  readonly size?: ButtonSize
  readonly fullWidth?: boolean
  readonly icon?: ReactNode
  readonly ariaLabel?: string
  readonly title?: string
}

export const Button = ({
  children, onClick, variant = 'ghost', size = 'md', fullWidth, icon, ariaLabel, title,
}: ButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: T.radiusSm,
      fontSize: 14,
      fontWeight: 500,
      fontFamily: 'inherit',
      cursor: 'pointer',
      width: fullWidth ? '100%' : undefined,
      transition: `background ${T.durationNormal} ${T.ease}, border-color ${T.durationNormal} ${T.ease}, color ${T.durationNormal} ${T.ease}`,
      ...SIZE[size],
      ...VARIANT[variant],
    }}
  >
    {icon}
    {children}
  </button>
)
