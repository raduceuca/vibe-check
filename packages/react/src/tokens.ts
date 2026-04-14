// ── Shared design tokens for the vibe-check widget ──────────────────────────
// Pure neutrals, no color tint. 14px minimum text. High contrast.

export const T = {
  // Backgrounds — pure neutral, no blue/green tint
  bg: 'rgba(12,12,12,0.97)',
  bgSubtle: 'rgba(255,255,255,0.03)',
  bgHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.05)',

  // Text — high contrast, always readable
  text: 'rgba(255,255,255,0.92)',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.4)',
  textMuted: 'rgba(255,255,255,0.35)',

  // Status — only for semantic indicators
  green: '#4ade80',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#ef4444',
  blue: '#60a5fa',

  // Radii (4px scale)
  radiusXs: 4,
  radiusSm: 6,
  radiusMd: 8,
  radiusLg: 12,
  radiusXl: 18,
  radiusPill: 24,

  // Shadows
  shadowSm: '0 2px 8px rgba(0,0,0,0.3)',
  shadowMd: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04)',
  shadowLg: '0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.04)',

  // Z-index scale (high values to sit above host page)
  zOverlay: 2147483630,
  zBadge: 2147483635,
  zPopover: 2147483640,
  zPanel: 2147483645,

  // Font
  font: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
  fontMono: 'ui-monospace, "SF Mono", "Cascadia Code", monospace',
  fontSize: 14,
} as const

// ── Shared styles ───────────────────────────────────────────────────────────

export const sectionHeaderStyle = {
  fontSize: 14,
  fontWeight: 500 as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: T.textTertiary,
  marginBottom: 8,
}
