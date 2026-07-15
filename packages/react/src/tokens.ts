// ── Shared design tokens for the vibe-check widget ──────────────────────────
// Thin JS accessor over the --wcgw-* CSS variables (the single source of truth,
// declared per theme in VibeCheck's injected stylesheet). Kept in sync with that
// scale; values flip with the theme via --wcgw-fg. Semantic tokens first; reach
// for the raw --wcgw-fg tint only for one-off alphas.

export const T = {
  // Surfaces
  bg: 'var(--wcgw-bg)',
  bgSubtle: 'var(--wcgw-surface)',
  bgHover: 'var(--wcgw-surface-hover)',
  border: 'var(--wcgw-border)',
  borderSubtle: 'var(--wcgw-border-subtle)',
  borderStrong: 'var(--wcgw-border-strong)',

  // Text ladder — four steps, high contrast (labels stay legible, not ghosted)
  text: 'var(--wcgw-text)',
  textSecondary: 'var(--wcgw-text-secondary)',
  textTertiary: 'var(--wcgw-text-tertiary)',
  textMuted: 'var(--wcgw-text-muted)',

  // Status — semantic indicators only (theme-tuned per mode)
  green: 'var(--wcgw-sev-success)',
  yellow: 'var(--wcgw-sev-warning)',
  orange: 'var(--wcgw-sev-error)',
  red: 'var(--wcgw-sev-critical)',
  blue: 'var(--wcgw-sev-info)',

  // Process inks — reserved for tiny proof signatures and diagnostic echoes.
  proofC: 'var(--wcgw-proof-c)',
  proofM: 'var(--wcgw-proof-m)',
  proofY: 'var(--wcgw-proof-y)',
  proofK: 'var(--wcgw-proof-k)',

  // Radii
  radiusXs: 'var(--wcgw-radius-xs)',
  radiusSm: 'var(--wcgw-radius-sm)',
  radiusMd: 'var(--wcgw-radius-md)',
  radiusLg: 'var(--wcgw-radius-lg)',
  radiusXl: 'var(--wcgw-radius-xl)',
  radiusPill: 'var(--wcgw-radius-pill)',

  // Shadows (base var + a hairline ring for definition on any host bg)
  shadowSm: 'var(--wcgw-shadow-sm)',
  shadowMd: 'var(--wcgw-shadow-md), 0 0 0 0.5px rgba(var(--wcgw-fg),0.04)',
  shadowLg: 'var(--wcgw-shadow-lg), 0 0 0 0.5px rgba(var(--wcgw-fg),0.04)',

  // Z-index scale (high values to sit above host page)
  zOverlay: 2147483630,
  zBadge: 2147483635,
  zPopover: 2147483640,
  zPanel: 2147483645,

  // Motion — one ease + three duration steps. Components compose transitions
  // from these instead of copy-pasting `cubic-bezier(0.4,0,0.2,1)` and ad-hoc
  // durations, so timing tunes in one place.
  ease: 'var(--wcgw-ease)',
  durationFast: 'var(--wcgw-duration-fast)',
  durationNormal: 'var(--wcgw-duration-normal)',
  durationSlow: 'var(--wcgw-duration-slow)',

  // Font
  font: 'var(--wcgw-font-sans)',
  fontMono: 'var(--wcgw-font-mono)',
  fontSize: 14,

  // Spacing — a 4px grid (--wcgw-space-1..6 = 4/8/12/16/20/24).
  space: (n: 1 | 2 | 3 | 4 | 5 | 6): string => `var(--wcgw-space-${n})`,
} as const
