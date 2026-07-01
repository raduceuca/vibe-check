import { useEffect, useLayoutEffect } from 'react'

// ── Design tokens + animations (injected once) ───────────────────────────────
// The single stylesheet that defines every --wcgw-* token and keyframe. Because
// it is injected before paint (see useAnimations), inline styles can reference
// var(--wcgw-*) with no hardcoded fallbacks — this file is the one place colour
// values are declared.

const STYLE_ID = 'vibe-check-styles'

const ANIMATIONS_CSS = `
@keyframes vc-breathe { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
@keyframes vc-fade-in { from { opacity: 0; transform: translate3d(0,4px,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
@keyframes vc-ring-in { from { stroke-dashoffset: var(--wcgw-circ); } }
@keyframes vc-count-pop { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
@keyframes vc-slide-in { from { opacity: 0; transform: translate3d(6px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
[data-wcgw] { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-variant-numeric: tabular-nums; text-wrap: pretty; }
/* ── Design tokens (adapted from the shared theme spec; all prefixed --wcgw) ──
   Scale tokens + the foreground-derived neutral ladder are theme-agnostic here —
   the neutrals flip automatically via --wcgw-fg. Only the anchors that genuinely
   differ per mode are set in the theme blocks below. Reach-for order:
   semantic token (--wcgw-text/-surface/-border/-sev-*) → the --wcgw-fg tint. */
[data-wcgw] {
  --wcgw-font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif;
  --wcgw-font-mono: ui-monospace, "SF Mono", "Cascadia Code", monospace;
  --wcgw-text-xs: 11px; --wcgw-text-sm: 12px; --wcgw-text-base: 14px; --wcgw-text-lg: 16px; --wcgw-text-xl: 20px; --wcgw-text-display: 34px;
  --wcgw-radius-xs: 4px; --wcgw-radius-sm: 6px; --wcgw-radius-md: 8px; --wcgw-radius-lg: 12px; --wcgw-radius-xl: 16px; --wcgw-radius-pill: 999px;
  --wcgw-ease: cubic-bezier(0.4,0,0.2,1); --wcgw-duration-fast: 0.15s; --wcgw-duration-normal: 0.2s; --wcgw-duration-slow: 0.4s;
  --wcgw-text: rgba(var(--wcgw-fg),0.96);
  --wcgw-text-secondary: rgba(var(--wcgw-fg),0.72);
  --wcgw-text-tertiary: rgba(var(--wcgw-fg),0.56);
  --wcgw-text-muted: rgba(var(--wcgw-fg),0.42);
  --wcgw-surface: rgba(var(--wcgw-fg),0.03);
  --wcgw-surface-sunken: rgba(var(--wcgw-fg),0.02);
  --wcgw-surface-hover: rgba(var(--wcgw-fg),0.06);
  --wcgw-border: rgba(var(--wcgw-fg),0.08);
  --wcgw-border-subtle: rgba(var(--wcgw-fg),0.05);
  --wcgw-border-strong: rgba(var(--wcgw-fg),0.14);
  --wcgw-focus-ring: rgba(var(--wcgw-fg),0.5);
  --wcgw-sev-neutral: rgba(var(--wcgw-fg),0.55);
  /* On-page annotation pins live on the host page, not our surface — a fixed
     alert red (+ its channels for tinting) so they read the same on any theme. */
  --wcgw-marker-rgb: 255,59,48;
  --wcgw-marker: rgb(var(--wcgw-marker-rgb));
  --wcgw-marker-fg: #fff;
}
[data-wcgw-theme="dark"] {
  --wcgw-fg: 255,255,255;
  --wcgw-bg: rgba(12,12,12,0.97);
  --wcgw-elevated: rgba(20,20,20,0.98);
  --wcgw-shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
  --wcgw-shadow-md: 0 8px 32px rgba(0,0,0,0.5);
  --wcgw-shadow-lg: 0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3);
  --wcgw-sev-info: #60a5fa; --wcgw-sev-warning: #facc15; --wcgw-sev-error: #fb923c; --wcgw-sev-critical: #f87171; --wcgw-sev-success: #4ade80;
  --wcgw-badge-alpha: 13%;
}
[data-wcgw-theme="light"] {
  --wcgw-fg: 28,28,30;
  --wcgw-bg: rgba(252,251,248,0.98);
  --wcgw-elevated: rgba(255,255,255,0.99);
  --wcgw-shadow-sm: 0 2px 8px rgba(20,20,22,0.08);
  --wcgw-shadow-md: 0 8px 28px rgba(20,20,22,0.13);
  --wcgw-shadow-lg: 0 12px 40px rgba(20,20,22,0.16), 0 2px 10px rgba(20,20,22,0.08);
  --wcgw-sev-info: #1d4ed8; --wcgw-sev-warning: #a16207; --wcgw-sev-error: #c2410c; --wcgw-sev-critical: #b91c1c; --wcgw-sev-success: #15803d;
  --wcgw-badge-alpha: 16%;
}
[data-wcgw-issue]:hover { background: rgba(var(--wcgw-fg),0.04) !important; }
[data-wcgw-pill]:hover { background: rgba(var(--wcgw-fg),0.06) !important; }
[data-wcgw-tab]:hover { background: rgba(var(--wcgw-fg),0.04) !important; }
[data-wcgw] button:hover { filter: brightness(1.12); }
[data-wcgw-pill] { transition: scale 0.12s ease, background 0.15s ease; }
/* Tactile press feedback (scale 0.96) on interactive controls. */
[data-wcgw] button:active, [data-wcgw-pill]:active { scale: 0.96; }
[data-wcgw] [role="button"]:focus-visible, [data-wcgw] [role="switch"]:focus-visible, [data-wcgw] button:focus-visible {
  outline: 2px solid rgba(var(--wcgw-fg),0.5); outline-offset: 2px; border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  [data-wcgw-breathe], [data-wcgw] * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  [data-wcgw] button:active, [data-wcgw-pill]:active { scale: 1; }
}
`

let styleRefCount = 0

// Inject the token stylesheet before the browser paints so every `var(--wcgw-*)`
// resolves on the first frame — this is what lets the codebase drop hardcoded
// colour fallbacks entirely. Falls back to useEffect under SSR (no window).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export const useAnimations = () => {
  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined') return
    styleRefCount++
    if (styleRefCount === 1) {
      const existing = document.getElementById(STYLE_ID)
      if (!existing) {
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = ANIMATIONS_CSS
        document.head.appendChild(style)
      }
    }
    return () => {
      styleRefCount--
      if (styleRefCount === 0) {
        document.getElementById(STYLE_ID)?.remove()
      }
    }
  }, [])
}
