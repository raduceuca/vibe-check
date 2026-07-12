import type { VibeSnapshot } from '@wcgw/vibe-check-core'

// ── Health scoring ──────────────────────────────────────────────────────────
export const getHealth = (s: VibeSnapshot) => {
  const n = s.issues.length; const fps = s.frameRate.fps
  // `labelColor` is the theme-tuned severity variable used for the badge text so
  // it stays legible on the light surface too.
  if (n > 3 || fps < 25) return { labelColor: 'var(--wcgw-sev-critical)', label: 'critical', vibeLabel: 'needs help' }
  if (n > 0 || fps < 40) return { labelColor: 'var(--wcgw-sev-warning)', label: 'issues', vibeLabel: 'some issues' }
  return { labelColor: 'var(--wcgw-sev-success)', label: 'healthy', vibeLabel: 'looking good' }
}

// ── Accent colors ───────────────────────────────────────────────────────────
// The UI is mostly monochromatic (neutrals from --wcgw-fg); colour appears only as
// a deliberate accent — the lifeline, the health dot, severity, problem states.
//
// Everything in the DOM references the severity tokens via `sevVar`. The single
// exception is the Liveline <canvas>, which cannot resolve CSS variables — so it
// gets a concrete hex from `SEV_HEX`. Keep SEV_HEX in sync with the --wcgw-sev-*
// definitions in theme.ts; it is the ONLY hardcoded palette left, and it exists
// solely because a canvas draw call needs a literal colour string.
export const SEV_HEX = {
  dark: { success: '#4ade80', warning: '#facc15', error: '#fb923c', critical: '#f87171', info: '#60a5fa' },
  light: { success: '#15803d', warning: '#a16207', error: '#c2410c', critical: '#b91c1c', info: '#1d4ed8' },
} as const
export type SevKey = keyof (typeof SEV_HEX)['dark']
// Canvas-only: literal hex for the lifeline draw call.
export const sevHex = (key: SevKey, light: boolean): string => SEV_HEX[light ? 'light' : 'dark'][key]
// DOM/SVG: the theme-tuned severity token (flips with the theme automatically).
export const sevVar = (key: SevKey): string => `var(--wcgw-sev-${key})`
// A soft glow of a severity token — box-shadow/drop-shadow can take color-mix,
// so we tint the token instead of appending a hex alpha to a concrete colour.
export const sevGlow = (key: SevKey, pct = 38): string =>
  `color-mix(in srgb, var(--wcgw-sev-${key}) ${pct}%, transparent)`

export const fpsKey = (fps: number): SevKey => fps >= 55 ? 'success' : fps >= 40 ? 'warning' : fps >= 25 ? 'error' : 'critical'
export const healthKey = (s: VibeSnapshot): SevKey => {
  const n = s.issues.length, fps = s.frameRate.fps
  return n > 3 || fps < 25 ? 'critical' : n > 0 || fps < 40 ? 'warning' : 'success'
}
export const vitalKey = (r?: string): SevKey => r === 'good' ? 'success' : r === 'needs-improvement' ? 'warning' : 'critical'
export const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
