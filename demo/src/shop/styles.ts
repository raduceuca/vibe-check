import type { CSSProperties } from 'react'

export const ink = '#111111'
export const mute = '#333333'
export const softMute = '#666666'
export const line = '#e6e6e6'
export const paper = '#ffffff'
export const soft = '#f7f7f5'

export const serif = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif'
export const sans = 'system-ui, -apple-system, "Segoe UI", sans-serif'

export const page: CSSProperties = {
  margin: 0,
  minHeight: '100vh',
  background: paper,
  color: ink,
  fontFamily: sans,
  fontSize: 16,
  lineHeight: 1.5,
}

export const section: CSSProperties = {
  padding: '48px 24px',
  maxWidth: 1080,
  margin: '0 auto',
}

export const h2: CSSProperties = {
  fontFamily: serif,
  fontSize: 28,
  fontWeight: 500,
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
  color: ink,
}

export const link: CSSProperties = {
  color: ink,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}

export const productName: CSSProperties = {
  fontFamily: serif,
  fontSize: 18,
  fontWeight: 500,
  color: ink,
  margin: '0 0 4px',
}
