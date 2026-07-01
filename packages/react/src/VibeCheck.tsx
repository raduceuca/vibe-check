import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { VibeIssue, VibeSnapshot, BeaconStatus } from '@wcgw/vibe-check-core'
import { SEO_CRITERIA_COUNT, AEO_CRITERIA_COUNT } from '@wcgw/vibe-check-core'
import { auditScore, gradeFor, scoreColor } from './panels/ui/ScoreRing.js'
import { useVibeCheck } from './hooks/useVibeCheck.js'
import { useIssueStore } from './hooks/useIssueStore.js'
import { usePreferences } from './hooks/usePreferences.js'
import { useClipboard } from './hooks/useClipboard.js'
import { VibeCheckProvider } from './context.js'
import { AgentPanel } from './panels/AgentPanel.js'
import { PromptsPanel } from './panels/PromptsPanel.js'
import { SettingsPanel } from './panels/SettingsPanel.js'
import { AuditPanel } from './panels/AuditPanel.js'
import { AnnotationOverlay } from './panels/AnnotationOverlay.js'
import { Gauge, Wrench, MagnifyingGlass, Robot, Lightbulb, SlidersHorizontal } from '@phosphor-icons/react'
import { Liveline, type LivelinePoint } from 'liveline'

type PanelType = 'fps' | 'vitals' | 'memory' | 'console' | 'issues'
type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type ViewTab = 'monitor' | 'agent' | 'seo' | 'aeo' | 'prompts' | 'settings'

export interface VibeCheckProps {
  readonly enabled?: boolean
  readonly position?: Position
  readonly panels?: readonly PanelType[]
  readonly beaconUrl?: string
  readonly onIssue?: (issue: VibeIssue) => void
}

import { T } from './tokens.js'

// ── CSS Animations (injected once) ──────────────────────────────────────────

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

const useAnimations = () => {
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

// ── Health scoring ──────────────────────────────────────────────────────────

const getHealth = (s: VibeSnapshot) => {
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
// definitions in the theme blocks above; it is the ONLY hardcoded palette left,
// and it exists solely because a canvas draw call needs a literal colour string.
const SEV_HEX = {
  dark: { success: '#4ade80', warning: '#facc15', error: '#fb923c', critical: '#f87171', info: '#60a5fa' },
  light: { success: '#15803d', warning: '#b45309', error: '#c2410c', critical: '#b91c1c', info: '#1d4ed8' },
} as const
type SevKey = keyof (typeof SEV_HEX)['dark']
// Canvas-only: literal hex for the lifeline draw call.
const sevHex = (key: SevKey, light: boolean): string => SEV_HEX[light ? 'light' : 'dark'][key]
// DOM/SVG: the theme-tuned severity token (flips with the theme automatically).
const sevVar = (key: SevKey): string => `var(--wcgw-sev-${key})`
// A soft glow of a severity token — box-shadow/drop-shadow can take color-mix,
// so we tint the token instead of appending a hex alpha to a concrete colour.
const sevGlow = (key: SevKey, pct = 38): string =>
  `color-mix(in srgb, var(--wcgw-sev-${key}) ${pct}%, transparent)`

const fpsKey = (fps: number): SevKey => fps >= 55 ? 'success' : fps >= 40 ? 'warning' : fps >= 25 ? 'error' : 'critical'
const healthKey = (s: VibeSnapshot): SevKey => {
  const n = s.issues.length, fps = s.frameRate.fps
  return n > 3 || fps < 25 ? 'critical' : n > 0 || fps < 40 ? 'warning' : 'success'
}
const vitalKey = (r?: string): SevKey => r === 'good' ? 'success' : r === 'needs-improvement' ? 'warning' : 'critical'
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`

// ── Position ────────────────────────────────────────────────────────────────

const POS: Record<Position, CSSProperties> = {
  'top-left': { top: 12, left: 12 }, 'top-right': { top: 12, right: 12 },
  'bottom-left': { bottom: 12, left: 12 }, 'bottom-right': { bottom: 12, right: 12 },
}

// ── Mini ring for collapsed pill ────────────────────────────────────────────

const MiniRing = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const sw = 2; const size = 20; const r = (size - sw * 2) / 2; const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(value / max, 1)); const mid = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(var(--wcgw-fg),0.08)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px color-mix(in srgb, ${color} 31%, transparent))`, transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  )
}

// ── Thin separator for the collapsed pill ───────────────────────────────────

const PillDivider = () => (
  <span aria-hidden="true" style={{ width: 1, height: 13, background: 'rgba(var(--wcgw-fg),0.12)', flexShrink: 0, margin: '0 1px' }} />
)

// ── Honest FPS history — real samples, persisted to localStorage ─────────────
// Two resolutions so the lifeline can zoom from live to an hour without storing
// or rendering tens of thousands of points: a full-res recent buffer (the live
// view) and a coarse buffer (one sample every LONG_STEP_SEC) for the 15m/1h
// views. Persisted (throttled) so the timeline survives reloads; samples are the
// measured frame rate verbatim — no smoothing.

interface FpsSample { readonly time: number; readonly value: number }
interface FpsHistory { readonly live: readonly FpsSample[]; readonly long: readonly FpsSample[] }
const EMPTY_HISTORY: FpsHistory = { live: [], long: [] }

const FPS_HISTORY_KEY = 'vibe-check:fps-history'
const LIVE_CAP = 1200 // ~10 min at the 500ms snapshot tick
const LONG_STEP_SEC = 15 // one coarse sample every 15s
const LONG_CAP = 280 // ~70 min of coarse samples
const STALE_SEC = 3600 // drop a stored session whose newest sample is older than this
const PERSIST_EVERY_MS = 8000

const isSample = (p: unknown): p is FpsSample =>
  !!p && typeof (p as FpsSample).time === 'number' && typeof (p as FpsSample).value === 'number'

// Restore the timeline across reloads. Validates shape, caps each buffer, and
// drops a stale session — there's a real downtime gap between sessions, so
// resurrecting an hours-old line as "live" would be dishonest.
const loadFpsHistory = (): FpsHistory => {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_HISTORY
    const parsed = JSON.parse(localStorage.getItem(FPS_HISTORY_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.live) || !Array.isArray(parsed.long)) return EMPTY_HISTORY
    const live = parsed.live.filter(isSample).slice(-LIVE_CAP)
    const long = parsed.long.filter(isSample).slice(-LONG_CAP)
    const newest = Math.max(live[live.length - 1]?.time ?? 0, long[long.length - 1]?.time ?? 0)
    if (!newest || newest < Date.now() / 1000 - STALE_SEC) return EMPTY_HISTORY
    return { live, long }
  } catch { return EMPTY_HISTORY }
}

const useFpsHistory = (fps: number, tick: number, persist: boolean): FpsHistory => {
  const [history, setHistory] = useState<FpsHistory>(() => (persist ? loadFpsHistory() : EMPTY_HISTORY))
  const lastPersist = useRef(0)

  useEffect(() => {
    if (tick === 0) return // no real snapshot yet
    const time = tick / 1000 // Liveline windows by `time` in Unix *seconds*
    const value = Math.round(fps)
    setHistory((prev) => {
      const live = [...prev.live, { time, value }].slice(-LIVE_CAP)
      const lastLong = prev.long[prev.long.length - 1]
      const long = !lastLong || time - lastLong.time >= LONG_STEP_SEC
        ? [...prev.long, { time, value }].slice(-LONG_CAP)
        : prev.long
      return { live, long }
    })
  }, [tick, fps])

  // Throttled persistence — writing the full buffer every tick would be a waste
  // for a perf tool to inflict on the page it's measuring.
  useEffect(() => {
    if (!persist || tick === 0 || tick - lastPersist.current < PERSIST_EVERY_MS) return
    lastPersist.current = tick
    try { localStorage.setItem(FPS_HISTORY_KEY, JSON.stringify(history)) } catch { /* full/blocked */ }
  }, [tick, persist, history])

  useEffect(() => {
    if (!persist) { try { localStorage.removeItem(FPS_HISTORY_KEY) } catch { /* noop */ } }
  }, [persist])

  return history
}

// ── Lifeline timescale ───────────────────────────────────────────────────────
const WINDOW_OPTIONS = [
  { secs: 30, label: 'live' },
  { secs: 300, label: '5m' },
  { secs: 900, label: '15m' },
  { secs: 3600, label: '1h' },
] as const

const winBtnStyle = (active: boolean): CSSProperties => ({
  fontSize: 14, fontWeight: active ? 600 : 500,
  color: active ? T.text : T.textTertiary,
  background: active ? 'rgba(var(--wcgw-fg),0.07)' : 'transparent',
  border: 'none', borderRadius: 5, padding: '3px 8px', minHeight: 26,
  cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
  transition: 'color 0.15s ease, background 0.15s ease',
})

// Liveline renders to a <canvas>; jsdom (tests) and SSR have none, so we fall
// back to the lightweight SVG trace there.
const CANVAS_OK = typeof document !== 'undefined' && (() => {
  try { return !!document.createElement('canvas').getContext('2d') } catch { return false }
})()

// ── Live FPS trace (oscilloscope) — SVG fallback when canvas is unavailable ──
// Keeps a rolling window of recent FPS samples and draws a single polyline.

const FpsTrace = ({ fps, tick, color, width = 292, height = 24, points = 70 }: {
  fps: number; tick: number; color: string; width?: number; height?: number; points?: number
}) => {
  const [series, setSeries] = useState<readonly number[]>([])
  useEffect(() => {
    setSeries((prev) => [...prev, Math.max(0, Math.min(60, fps))].slice(-points))
  }, [tick, fps, points])

  const pad = 2
  const h = height - pad * 2
  const poly = series.map((v, i) => {
    const x = series.length <= 1 ? width : (i / (points - 1)) * width
    const y = pad + (1 - v / 60) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={poly} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.55} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Borderless type-and-space helpers (Quiet Instrument) ────────────────────

// ── Type scale ───────────────────────────────────────────────────────────────
// TWO sizes only: DISPLAY (the one hero number) and TEXT (14px — everything
// else). Hierarchy comes from weight, case, and the text-colour ladder, never
// from more sizes. Codified so styles can't drift back into a dozen ad-hoc px.
const DISPLAY_PX = 34
const TEXT_PX = 14
const T_VALUE: CSSProperties = { fontSize: TEXT_PX, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: T.text }
const T_LABEL: CSSProperties = { fontSize: TEXT_PX, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.textTertiary }
const T_UNIT: CSSProperties = { fontSize: TEXT_PX, fontWeight: 500, color: T.textTertiary }

const KICKER: CSSProperties = { ...T_LABEL }
const SUBKICKER: CSSProperties = { ...T_LABEL, marginBottom: 6 }
const STAT_LABEL: CSSProperties = { ...T_LABEL, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const STAT_VALUE: CSSProperties = { ...T_VALUE, display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }
const STAT_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignItems: 'start' }
// Hairline that separates the panel's major blocks without a hard border.
const DIVIDER: CSSProperties = { borderTop: '1px solid rgba(var(--wcgw-fg),0.07)', paddingTop: 14, marginTop: 4 }
// Finer, tighter separation for related sub-groups (e.g. FPS -> its metrics).
const FINE: CSSProperties = { borderTop: '1px solid rgba(var(--wcgw-fg),0.05)', paddingTop: 11, marginTop: 11 }

const QUIET_LINK: CSSProperties = {
  fontSize: 14, fontWeight: 500, color: T.textSecondary,
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none', padding: '4px 2px', minHeight: 30,
  transition: 'color 0.2s ease, scale 0.12s ease',
}

const ConsoleStat = ({ count, color, label }: { count: number; color: string; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: count > 0 ? color : 'rgba(var(--wcgw-fg),0.15)', flexShrink: 0 }} />
    <span style={{ color: count > 0 ? T.textSecondary : T.textMuted, fontWeight: count > 0 ? 600 : 400 }}>{count}</span>
    <span style={{ color: T.textTertiary }}>{label}</span>
  </span>
)

// Compact metric for the FPS-hero row — value over label, aligned to the grid.
const MiniMetric = ({ label, value, color }: { label: string; value: ReactNode; color?: string }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...T_VALUE, color: color ?? T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    <div style={STAT_LABEL}>{label}</div>
  </div>
)

// Compact audit score cell — value + grade over a label; click jumps to the tab.
const AuditScoreChip = ({ label, score, onClick }: { label: string; score: number; onClick: () => void }) => {
  const c = scoreColor(score)
  return (
    <button type="button" onClick={onClick} style={{
      minWidth: 0, display: 'block', textAlign: 'left', padding: 0,
      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
    }}>
      <div style={{ ...STAT_VALUE, gap: 5, color: c }}>
        {score}<span style={{ fontWeight: 600 }}>{gradeFor(score)}</span>
      </div>
      <div style={STAT_LABEL}>{label}</div>
    </button>
  )
}

// ── FONT ────────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif'

// ── View tab nav ────────────────────────────────────────────────────────────

const TAB_CONFIG: readonly { readonly key: ViewTab; readonly label: string; readonly vibeLabel: string }[] = [
  { key: 'monitor', label: 'Monitor', vibeLabel: 'Stats' },
  { key: 'agent', label: 'Agent', vibeLabel: 'Fix' },
  { key: 'seo', label: 'SEO', vibeLabel: 'SEO' },
  { key: 'aeo', label: 'AEO', vibeLabel: 'AEO' },
  { key: 'prompts', label: 'Prompts', vibeLabel: 'Ask AI' },
  { key: 'settings', label: 'Settings', vibeLabel: 'Settings' },
]

// Module-level constants — stable identity avoids re-renders of any memoized
// descendants and keeps hot-path style diffing cheap.
const NAV_TAB_BASE: CSSProperties = {
  flex: 1,
  padding: '12px 2px 11px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 0.2s ease, scale 0.12s ease',
  fontFamily: 'inherit',
  outline: 'none',
  minHeight: 44,
  position: 'relative',
}

const NAV_TAB_ACTIVE: CSSProperties = {
  ...NAV_TAB_BASE,
  fontWeight: 600,
  color: T.text,
}

const NAV_TAB_INACTIVE: CSSProperties = {
  ...NAV_TAB_BASE,
  fontWeight: 500,
  color: T.textTertiary,
}

const navTabStyle = (active: boolean): CSSProperties =>
  active ? NAV_TAB_ACTIVE : NAV_TAB_INACTIVE

// Count dot for icon tabs — sits at the upper-right of the centered icon.
const NAV_DOT: CSSProperties = {
  position: 'absolute', top: 9, left: 'calc(50% + 7px)',
  width: 6, height: 6, borderRadius: '50%',
  background: 'var(--wcgw-sev-warning)',
}
const SR_ONLY: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }

// ── Tab icons (Phosphor, bold weight — thicker, rounder) ────────────────────

const ICON_SIZE = 20

const NavIcon = ({ name }: { name: ViewTab }) => {
  switch (name) {
    case 'monitor': return <Gauge size={ICON_SIZE} weight="bold" />
    case 'agent': return <Wrench size={ICON_SIZE} weight="bold" />
    case 'seo': return <MagnifyingGlass size={ICON_SIZE} weight="bold" />
    case 'aeo': return <Robot size={ICON_SIZE} weight="bold" />
    case 'prompts': return <Lightbulb size={ICON_SIZE} weight="bold" />
    case 'settings': return <SlidersHorizontal size={ICON_SIZE} weight="bold" />
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

const DEFAULT_PANELS: readonly PanelType[] = ['fps', 'vitals', 'memory', 'console', 'issues']

export const VibeCheck = ({
  enabled = true, position = 'bottom-right',
  panels = DEFAULT_PANELS,
  beaconUrl, onIssue,
}: VibeCheckProps) => {
  useAnimations()
  const [collapsed, setCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<ViewTab>('monitor')
  const config = useMemo(() => beaconUrl ? { beaconUrl } : undefined, [beaconUrl])
  const { engine, snapshot } = useVibeCheck(config, enabled)
  const { prefs, updatePrefs, toggleMode } = usePreferences()
  const { copiedId, copy } = useClipboard()
  const { tracked, markSent, markSentBatch, markResolved, clearResolved, clearAll } = useIssueStore(snapshot.issues)
  const mode = prefs.mode
  // Honest performance lifeline — accrues even while collapsed.
  const fpsHistory = useFpsHistory(snapshot.frameRate.fps, snapshot.timestamp, prefs.keepHistory)
  const [chartWindow, setChartWindow] = useState(30)
  // Live/5m read the full-res buffer; 15m/1h read the coarse one.
  const chartData = chartWindow <= 300 ? fpsHistory.live : fpsHistory.long

  // Real beacon delivery status, re-read each snapshot tick (~500ms) so the
  // settings indicator reflects whether snapshots actually reach the MCP server
  // rather than merely "a beaconUrl is configured". Null when no beacon.
  const beaconStatus: BeaconStatus | null = beaconUrl ? (engine?.getBeaconStatus() ?? null) : null

  // "Clear annotations on send": when enabled, hide the on-page markers as
  // issues are dispatched to the agent. Wrap the mark-sent handlers so the
  // toggle has a real effect (previously it was persisted but never read).
  const handleMarkSent = useCallback((issueId: string) => {
    markSent(issueId)
    if (prefs.clearOnSend) updatePrefs({ annotationsVisible: false })
  }, [markSent, prefs.clearOnSend, updatePrefs])

  const handleMarkSentBatch = useCallback((issueIds: readonly string[]) => {
    markSentBatch(issueIds)
    if (prefs.clearOnSend) updatePrefs({ annotationsVisible: false })
  }, [markSentBatch, prefs.clearOnSend, updatePrefs])

  const reportedRef = useRef(new Set<string>())
  useEffect(() => {
    if (!onIssue) return
    for (const issue of snapshot.issues) {
      if (!reportedRef.current.has(issue.id)) {
        reportedRef.current.add(issue.id)
        onIssue(issue)
      }
    }
  }, [snapshot.issues, onIssue])

  const toggle = useCallback(() => setCollapsed((p) => !p), [])
  const h = useMemo(() => getHealth(snapshot), [snapshot])
  const ps = useMemo(() => new Set(panels), [panels])

  const isLight = prefs.theme === 'light'
  const hKey = healthKey(snapshot)
  const hColor = sevVar(hKey)

  const activeCount = tracked.filter((t) => t.status === 'new').length
  const seoCount = tracked.filter((t) => t.issue.detector === 'seo' && t.status === 'new').length
  const aeoCount = tracked.filter((t) => t.issue.detector === 'aeo' && t.status === 'new').length

  // Audit scores for the dashboard chips — unresolved findings vs total criteria.
  const seoScore = auditScore(SEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'seo' && t.status !== 'resolved').length)
  const aeoScore = auditScore(AEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'aeo' && t.status !== 'resolved').length)

  if (!enabled) return null
  const pos = POS[position]

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNOTATION OVERLAY
  // ═══════════════════════════════════════════════════════════════════════════
  const annotationOverlay = (
    <AnnotationOverlay
      tracked={tracked}
      visible={prefs.annotationsVisible && !collapsed}
      mode={mode}
      theme={prefs.theme}
      copiedId={copiedId}
      onCopy={copy}
      onMarkSent={handleMarkSent}
      onMarkResolved={markResolved}
    />
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLAPSED — Floating pill
  // ═══════════════════════════════════════════════════════════════════════════
  if (collapsed) {
    return (
      <>
        {annotationOverlay}
        <div style={{ position: 'fixed', zIndex: T.zPanel, ...pos }} data-testid="vibe-check-overlay" data-wcgw data-wcgw-theme={prefs.theme}>
          <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header" data-wcgw-pill
            aria-label={`Expand vibe check — ${Math.round(snapshot.frameRate.fps)} fps, ${activeCount} issues`} aria-expanded={false}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 13px 9px 11px', minHeight: 44,
              fontFamily: FONT, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
              WebkitFontSmoothing: 'antialiased',
              color: T.text,
              background: T.bg,
              borderRadius: 22, cursor: 'pointer', userSelect: 'none',
              border: `1px solid ${T.border}`,
              boxShadow: `var(--wcgw-shadow-md), 0 0 0 0.5px rgba(var(--wcgw-fg),0.04)`,
              backdropFilter: 'blur(24px)',
              animation: 'vc-fade-in 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}>
            {/* Overall health */}
            <span data-wcgw-breathe aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: '50%', background: hColor, flexShrink: 0,
              boxShadow: `0 0 8px ${sevGlow(hKey)}`, animation: 'vc-breathe 3s ease-in-out infinite',
            }} />
            {/* FPS */}
            <MiniRing value={snapshot.frameRate.fps} max={60} color={sevVar(fpsKey(snapshot.frameRate.fps))} />
            <span style={{ fontWeight: 600 }}>{Math.round(snapshot.frameRate.fps)}</span>
            <span style={{ color: T.textTertiary, fontWeight: 400 }}>fps</span>
            {/* Memory (Chrome only) */}
            {snapshot.memory && (
              <>
                <PillDivider />
                <span style={{ fontWeight: 600 }}>{snapshot.memory.jsHeapSizeMB.toFixed(0)}</span>
                <span style={{ color: T.textTertiary, fontWeight: 400 }}>MB</span>
              </>
            )}
            {/* Issues */}
            {activeCount > 0 && (
              <>
                <PillDivider />
                <span style={{
                  fontWeight: 700, color: h.labelColor,
                  background: `color-mix(in srgb, ${h.labelColor} 16%, transparent)`, padding: '1px 7px', borderRadius: 6,
                }}>{activeCount}</span>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED — Full panel with tabbed navigation
  // ═══════════════════════════════════════════════════════════════════════════
  const fc = sevHex(fpsKey(snapshot.frameRate.fps), isLight)

  return (
    <VibeCheckProvider value={engine}>
      {annotationOverlay}
      <div data-testid="vibe-check-overlay" data-wcgw data-wcgw-theme={prefs.theme} style={{
        position: 'fixed', zIndex: T.zPanel, width: 320, maxWidth: 'calc(100vw - 24px)', fontFamily: FONT, fontSize: 14,
        color: T.text, overflow: 'hidden',
        background: T.bg,
        borderRadius: 16,
        boxShadow: `var(--wcgw-shadow-lg), 0 0 0 0.5px rgba(var(--wcgw-fg),0.08)`,
        backdropFilter: 'blur(32px)',
        animation: 'vc-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)',
        ...pos,
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px 6px', cursor: 'default', userSelect: 'none',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header"
              aria-label="Collapse vibe check panel" aria-expanded={true}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <span data-wcgw-breathe style={{
                width: 8, height: 8, borderRadius: '50%', background: hColor, flexShrink: 0,
                boxShadow: `0 0 8px ${sevGlow(hKey)}`, animation: 'vc-breathe 3s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                vibe check
              </span>
            </div>
            <span style={{
              fontSize: 14, fontWeight: 500, color: h.labelColor,
              background: `color-mix(in srgb, ${h.labelColor} 14%, transparent)`, padding: '2px 8px', borderRadius: 6,
            }}>{mode === 'vibe' ? h.vibeLabel : h.label}</span>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {/* Fixed body height keeps the panel a stable size as you switch tabs
            (short tabs no longer make it shrink and jump). Clamps on short
            viewports; content beyond it scrolls. */}
        <div data-testid="vibe-check-body" style={{ height: 'min(420px, calc(100vh - 168px))', overflowY: 'auto', overscrollBehavior: 'contain', padding: '10px 16px 14px' }}>

          {/* ── MONITOR VIEW ───────────────────────────────────────── */}
          {activeView === 'monitor' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              {/* FPS HERO — quiet numeral + avg/worst + live trace */}
              {ps.has('fps') && (
                <div style={{ paddingBottom: 14 }}>
                  {/* Main metric — FPS, left-aligned */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: DISPLAY_PX, fontWeight: 600, lineHeight: 1, color: T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{Math.round(snapshot.frameRate.fps)}</span>
                    <span style={T_UNIT}>fps</span>
                  </div>
                  <div style={{ ...T_UNIT, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
                    avg {snapshot.frameRate.avgFrameTime.toFixed(1)} · worst <span style={{ color: snapshot.frameRate.maxFrameTime > 50 ? sevVar('error') : T.textSecondary }}>{snapshot.frameRate.maxFrameTime.toFixed(0)}ms</span>
                  </div>

                  {/* Secondary metrics — stacked under the FPS, left-aligned, fine separation */}
                  {(ps.has('vitals') || ps.has('memory')) && (
                    <div style={{ ...FINE, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                      {ps.has('vitals') && (['lcp', 'inp', 'cls'] as const).map((key) => {
                        const v = snapshot.webVitals[key]
                        const poor = !!v && v.rating !== 'good'
                        const val = key === 'cls' ? (v ? v.value.toFixed(3) : '—') : (v ? fmtMs(v.value) : '—')
                        const vibeLabels: Record<string, string> = { lcp: 'load', inp: 'response', cls: 'stability' }
                        return (
                          <MiniMetric key={key} label={mode === 'vibe' ? vibeLabels[key] : key} value={val} color={!v ? T.textMuted : poor ? sevVar(vitalKey(v.rating)) : T.text} />
                        )
                      })}
                      {ps.has('memory') && (
                        <MiniMetric
                          label={mode === 'vibe' ? 'mem' : 'heap'}
                          value={snapshot.memory ? `${snapshot.memory.jsHeapSizeMB.toFixed(0)} MB` : 'n/a'}
                          color={snapshot.memory ? (snapshot.memory.usedPct > 80 ? sevVar('critical') : snapshot.memory.usedPct > 60 ? sevVar('warning') : T.text) : T.textMuted}
                        />
                      )}
                    </div>
                  )}
                  {/* The lifeline — the one prominent accent. Parent sets the height. */}
                  <div style={{ marginTop: 12, height: 96 }}>
                    {CANVAS_OK ? (
                      <Liveline
                        data={chartData as unknown as LivelinePoint[]}
                        value={Math.round(snapshot.frameRate.fps)}
                        theme={prefs.theme}
                        color={fc}
                        window={chartWindow}
                        lineWidth={2}
                        fill
                        pulse
                        grid={false}
                        badge={false}
                        scrub={false}
                        momentum={false}
                        showValue={false}
                        exaggerate={false}
                        referenceLine={{ value: 60 }}
                        emptyText="measuring…"
                      />
                    ) : (
                      <FpsTrace fps={snapshot.frameRate.fps} tick={snapshot.timestamp} color={fc} />
                    )}
                  </div>
                  {/* Timescale selector — live / 5m / 15m / 1h */}
                  {CANVAS_OK && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-start', marginTop: 4 }}>
                      {WINDOW_OPTIONS.map((o) => (
                        <button key={o.secs} type="button" style={winBtnStyle(chartWindow === o.secs)} onClick={() => setChartWindow(o.secs)}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AUDITS — SEO + AEO scores on the same grid; click opens the tab */}
              <div style={{ ...DIVIDER, paddingBottom: 14 }}>
                <div style={SUBKICKER}>audits</div>
                <div style={STAT_GRID}>
                  <AuditScoreChip label={mode === 'vibe' ? 'search' : 'seo'} score={seoScore} onClick={() => setActiveView('seo')} />
                  <AuditScoreChip label={mode === 'vibe' ? 'ai answers' : 'aeo'} score={aeoScore} onClick={() => setActiveView('aeo')} />
                </div>
              </div>

              {/* ISSUES — count heading + borderless tick rows */}
              {ps.has('issues') && (
                <div style={DIVIDER}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={KICKER}>
                      {mode === 'vibe' ? 'problems' : 'issues'}
                      {activeCount > 0 && <span style={{ color: T.textSecondary, marginLeft: 6, fontWeight: 600 }}>{activeCount}</span>}
                    </div>
                    {activeCount > 0 && (
                      <button onClick={() => setActiveView('agent')} style={QUIET_LINK}>
                        {mode === 'vibe' ? 'fix with AI →' : 'view prompts →'}
                      </button>
                    )}
                  </div>
                  {/* Console breakdown — these problems come from the console log */}
                  {ps.has('console') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontVariantNumeric: 'tabular-nums', marginBottom: 10 }}>
                      <span style={T_LABEL}>console</span>
                      <ConsoleStat count={snapshot.console.errorCount} color={sevVar('critical')} label="err" />
                      <ConsoleStat count={snapshot.console.warnCount} color={sevVar('warning')} label="wrn" />
                      <ConsoleStat count={snapshot.console.logCount} color={T.textTertiary} label="log" />
                    </div>
                  )}
                  {activeCount === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: T.textSecondary }}>
                      <span data-wcgw-breathe style={{
                        width: 7, height: 7, borderRadius: '50%', background: sevVar('success'),
                        boxShadow: `0 0 6px ${sevGlow('success', 31)}`, animation: 'vc-breathe 3s ease-in-out infinite',
                      }} />
                      {mode === 'vibe' ? 'All vibes are good' : 'No active issues'}
                    </div>
                  ) : (
                    <div>
                      {tracked.filter((t) => t.status === 'new').slice(0, 4).map((t) => (
                        <QuickIssue key={t.issue.id} issue={t.issue} mode={mode} />
                      ))}
                      {activeCount > 4 && (
                        <button onClick={() => setActiveView('agent')} style={{ ...QUIET_LINK, marginTop: 4 }}>
                          +{activeCount - 4} more →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── AGENT VIEW ─────────────────────────────────────────── */}
          {activeView === 'agent' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              <AgentPanel
                tracked={tracked}
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                onMarkSent={handleMarkSent}
                onMarkSentBatch={handleMarkSentBatch}
                onMarkResolved={markResolved}
                onClearResolved={clearResolved}
              />
            </div>
          )}

          {/* ── SEO VIEW ──────────────────────────────────────────── */}
          {activeView === 'seo' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              <AuditPanel
                tracked={tracked}
                detector="seo"
                heading="Search visibility"
                vibeHeading="Found on Google"
                subtitle="Whether search engines can find, read, and rank this page — and how it previews when shared."
                vibeSubtitle="How your page shows up on Google and in shared links."
                emptyLabel="Search-ready — every check passes"
                vibeEmptyLabel="This page is ready for Google"
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                onMarkSent={handleMarkSent}
              />
            </div>
          )}

          {/* ── AEO VIEW ──────────────────────────────────────────── */}
          {activeView === 'aeo' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              <AuditPanel
                tracked={tracked}
                detector="aeo"
                heading="AI answers"
                vibeHeading="AI-ready"
                subtitle="Whether AI assistants — ChatGPT, Perplexity, Claude — can read this page and cite it in answers."
                vibeSubtitle="Whether ChatGPT, Perplexity & Claude can read and recommend this page."
                emptyLabel="AI-ready — every check passes"
                vibeEmptyLabel="Ready for AI assistants to read and cite"
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                onMarkSent={handleMarkSent}
              />
            </div>
          )}

          {/* ── PROMPTS VIEW ──────────────────────────────────────── */}
          {activeView === 'prompts' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              <PromptsPanel mode={mode} copiedId={copiedId} onCopy={copy} />
            </div>
          )}

          {/* ── SETTINGS VIEW ────────────────────────────────────── */}
          {activeView === 'settings' && (
            <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
              <SettingsPanel prefs={prefs} onUpdate={updatePrefs} mode={mode} onToggleMode={toggleMode} beaconUrl={beaconUrl} beaconStatus={beaconStatus} onClearAll={clearAll} />
            </div>
          )}
        </div>

        {/* ── Bottom navigation ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexShrink: 0,
          position: 'relative',
          paddingTop: 1,
        }}>
          {/* One accent bar that SLIDES between tab centers (signature motion) */}
          <span aria-hidden="true" style={{
            position: 'absolute', top: 0,
            left: `calc((${TAB_CONFIG.findIndex((t) => t.key === activeView)} + 0.5) * (100% / ${TAB_CONFIG.length}))`,
            transform: 'translateX(-50%)',
            width: 18, height: 2, borderRadius: '0 0 3px 3px', background: T.text,
            transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
          }} />
          {TAB_CONFIG.map((tab) => {
            const active = activeView === tab.key
            const count = tab.key === 'agent' ? activeCount
              : tab.key === 'seo' ? seoCount
              : tab.key === 'aeo' ? aeoCount
              : 0
            return (
              <button
                key={tab.key}
                data-wcgw-tab
                style={navTabStyle(active)}
                onClick={() => setActiveView(tab.key)}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
                title={tab.label}
              >
                <NavIcon name={tab.key} />
                {count > 0 && (
                  <>
                    <span aria-hidden="true" style={NAV_DOT} />
                    <span style={SR_ONLY}>({count} issues)</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </VibeCheckProvider>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

const SEV_TICK: Record<string, string> = {
  info: 'var(--wcgw-sev-info)',
  warning: 'var(--wcgw-sev-warning)',
  error: 'var(--wcgw-sev-error)',
  critical: 'var(--wcgw-sev-critical)',
}

const QuickIssue = ({ issue, mode }: { readonly issue: VibeIssue; mode: string }) => {
  const c = SEV_TICK[issue.severity] ?? SEV_TICK['error']
  const vibeTitle = mode === 'vibe'
    ? issue.title.replace(/DOM/g, 'page elements').replace(/\bheap\b/gi, 'memory').replace(/\bCLS\b/g, 'layout shift')
    : issue.title

  return (
    <div style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'stretch' }}>
      <span style={{ width: 3, minHeight: 15, borderRadius: 2, background: c, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: T.textSecondary, alignSelf: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{vibeTitle}</span>
    </div>
  )
}
