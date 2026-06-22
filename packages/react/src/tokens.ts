// ── Shared design tokens for the vibe-check widget ──────────────────────────
// Pure neutrals, no color tint. 14px minimum text. High contrast.

export const T = {
  // Backgrounds — pure neutral. `--vc-fg` (set per theme on the panel root) is
  // the foreground tint — white in dark mode, near-black in light mode — so
  // every `rgba(var(--vc-fg),a)` surface/border/text flips with the theme.
  bg: 'var(--vc-panel-bg, rgba(12,12,12,0.97))',
  bgSubtle: 'rgba(var(--vc-fg,255,255,255),0.03)',
  bgHover: 'rgba(var(--vc-fg,255,255,255),0.06)',
  border: 'rgba(var(--vc-fg,255,255,255),0.08)',
  borderSubtle: 'rgba(var(--vc-fg,255,255,255),0.05)',

  // Text — high contrast, always readable
  text: 'rgba(var(--vc-fg,255,255,255),0.92)',
  textSecondary: 'rgba(var(--vc-fg,255,255,255),0.6)',
  textTertiary: 'rgba(var(--vc-fg,255,255,255),0.4)',
  textMuted: 'rgba(var(--vc-fg,255,255,255),0.35)',

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
  shadowMd: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(var(--vc-fg,255,255,255),0.04)',
  shadowLg: '0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(var(--vc-fg,255,255,255),0.04)',

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
