import { useState, useCallback, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import type { VibeIssue, VibeSnapshot, BeaconStatus } from '@wcgw/vibe-check-core'
import { useVibeCheck } from './hooks/useVibeCheck.js'
import { useIssueStore } from './hooks/useIssueStore.js'
import { usePreferences } from './hooks/usePreferences.js'
import { useClipboard } from './hooks/useClipboard.js'
import { VibeCheckProvider } from './context.js'
import { ModeToggle } from './panels/ui/ModeToggle.js'
import { AgentPanel } from './panels/AgentPanel.js'
import { PromptsPanel } from './panels/PromptsPanel.js'
import { SettingsPanel } from './panels/SettingsPanel.js'
import { AuditPanel } from './panels/AuditPanel.js'
import { AnnotationOverlay } from './panels/AnnotationOverlay.js'

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
@keyframes vc-ring-in { from { stroke-dashoffset: var(--vc-circ); } }
@keyframes vc-count-pop { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
@keyframes vc-slide-in { from { opacity: 0; transform: translate3d(6px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
[data-vc] { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-variant-numeric: tabular-nums; text-wrap: pretty; }
/* Theme tokens. --vc-fg is the foreground tint applied to every
   rgba(var(--vc-fg),a) surface/border/text, so one variable flips the theme. */
[data-vc-theme="dark"] { --vc-fg: 255,255,255; --vc-panel-bg: rgba(12,12,12,0.97); --vc-shadow-lg: 0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3); --vc-shadow-md: 0 8px 32px rgba(0,0,0,0.5); }
[data-vc-theme="light"] { --vc-fg: 28,28,30; --vc-panel-bg: rgba(252,251,248,0.98); --vc-shadow-lg: 0 12px 40px rgba(20,20,22,0.16), 0 2px 10px rgba(20,20,22,0.08); --vc-shadow-md: 0 8px 28px rgba(20,20,22,0.13); }
[data-vc-issue]:hover { background: rgba(var(--vc-fg,255,255,255),0.04) !important; }
[data-vc-pill]:hover { background: rgba(var(--vc-fg,255,255,255),0.06) !important; }
[data-vc-tab]:hover { background: rgba(var(--vc-fg,255,255,255),0.04) !important; }
[data-vc] button:hover { filter: brightness(1.12); }
[data-vc-pill] { transition: scale 0.12s ease, background 0.15s ease; }
/* Tactile press feedback (scale 0.96) on interactive controls. */
[data-vc] button:active, [data-vc-pill]:active { scale: 0.96; }
[data-vc] [role="button"]:focus-visible, [data-vc] [role="switch"]:focus-visible, [data-vc] button:focus-visible {
  outline: 2px solid rgba(var(--vc-fg,255,255,255),0.5); outline-offset: 2px; border-radius: 4px;
}
@media (prefers-reduced-motion: reduce) {
  [data-vc-breathe], [data-vc] * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  [data-vc] button:active, [data-vc-pill]:active { scale: 1; }
}
`

let styleRefCount = 0

const useAnimations = () => {
  useEffect(() => {
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
  if (n > 3 || fps < 25) return { color: T.red, glow: 'rgba(239,68,68,0.15)', label: 'critical', vibeLabel: 'needs help' }
  if (n > 0 || fps < 40) return { color: T.yellow, glow: 'rgba(250,204,21,0.1)', label: 'issues', vibeLabel: 'some issues' }
  return { color: T.green, glow: 'rgba(74,222,128,0.1)', label: 'healthy', vibeLabel: 'looking good' }
}

// ── Colors ──────────────────────────────────────────────────────────────────

const fpsColor = (fps: number) => fps >= 55 ? T.green : fps >= 40 ? T.yellow : fps >= 25 ? T.orange : T.red
const vitalColor = (r?: string) => r === 'good' ? T.green : r === 'needs-improvement' ? T.yellow : T.red
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`

// ── Position ────────────────────────────────────────────────────────────────

const POS: Record<Position, CSSProperties> = {
  'top-left': { top: 12, left: 12 }, 'top-right': { top: 12, right: 12 },
  'bottom-left': { bottom: 12, left: 12 }, 'bottom-right': { bottom: 12, right: 12 },
}

// ── Gradient Ring Gauge ─────────────────────────────────────────────────────

const Ring = ({ value, max, color, size = 56 }: { value: number; max: number; color: string; size?: number }) => {
  const sw = 3; const r = (size - sw * 2) / 2; const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(value / max, 1)); const mid = size / 2
  const gid = `vc-rg-${size}`

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={T.green} />
          <stop offset="50%" stopColor={T.yellow} />
          <stop offset="100%" stopColor={T.red} />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(var(--vc-fg,255,255,255),0.06)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none"
        stroke={value / max > 0.65 ? color : `url(#${gid})`}
        strokeWidth={sw} strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)`, transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ── Mini ring for collapsed pill ────────────────────────────────────────────

const MiniRing = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const sw = 2; const size = 20; const r = (size - sw * 2) / 2; const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(value / max, 1)); const mid = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(var(--vc-fg,255,255,255),0.08)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}50)`, transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  )
}

// ── Thin separator for the collapsed pill ───────────────────────────────────

const PillDivider = () => (
  <span aria-hidden="true" style={{ width: 1, height: 13, background: 'rgba(var(--vc-fg,255,255,255),0.12)', flexShrink: 0, margin: '0 1px' }} />
)

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
  fontSize: 13,
  letterSpacing: '0',
  textAlign: 'center',
  whiteSpace: 'nowrap',
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

// Clean active-tab indicator: a short centered bar at the top edge of the nav
// (doesn't touch the panel's rounded corners the way a full-width border did).
const NAV_INDICATOR: CSSProperties = {
  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
  width: 18, height: 2, borderRadius: '0 0 3px 3px', background: T.text,
}
const NAV_DOT: CSSProperties = {
  display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
  background: T.yellow, marginLeft: 5, boxShadow: `0 0 4px ${T.yellow}50`,
  verticalAlign: 'middle',
}
const SR_ONLY: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }

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

  const activeCount = tracked.filter((t) => t.status === 'new').length
  const seoCount = tracked.filter((t) => t.issue.detector === 'seo' && t.status === 'new').length
  const aeoCount = tracked.filter((t) => t.issue.detector === 'aeo' && t.status === 'new').length

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
        <div style={{ position: 'fixed', zIndex: T.zPanel, ...pos }} data-testid="vibe-check-overlay" data-vc data-vc-theme={prefs.theme}>
          <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header" data-vc-pill
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
              boxShadow: `var(--vc-shadow-md, 0 8px 32px rgba(0,0,0,0.5)), 0 0 0 0.5px rgba(var(--vc-fg,255,255,255),0.04)`,
              backdropFilter: 'blur(24px)',
              animation: 'vc-fade-in 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}>
            {/* Overall health */}
            <span data-vc-breathe aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0,
              boxShadow: `0 0 8px ${h.color}60`, animation: 'vc-breathe 3s ease-in-out infinite',
            }} />
            {/* FPS */}
            <MiniRing value={snapshot.frameRate.fps} max={60} color={fpsColor(snapshot.frameRate.fps)} />
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
                  fontWeight: 700, color: h.color,
                  background: `${h.color}1f`, padding: '1px 7px', borderRadius: 6,
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
  const fc = fpsColor(snapshot.frameRate.fps)

  return (
    <VibeCheckProvider value={engine}>
      {annotationOverlay}
      <div data-testid="vibe-check-overlay" data-vc data-vc-theme={prefs.theme} style={{
        position: 'fixed', zIndex: T.zPanel, width: 320, maxWidth: 'calc(100vw - 24px)', fontFamily: FONT, fontSize: 14,
        color: T.text, overflow: 'hidden',
        background: T.bg,
        borderRadius: 18, border: `1px solid ${T.border}`,
        boxShadow: `var(--vc-shadow-lg, 0 12px 48px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.3)), 0 0 0 0.5px rgba(var(--vc-fg,255,255,255),0.04)`,
        backdropFilter: 'blur(32px)',
        animation: 'vc-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)',
        ...pos,
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px 9px', cursor: 'default', userSelect: 'none',
          borderBottom: `1px solid ${T.borderSubtle}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header"
              aria-label="Collapse vibe check panel" aria-expanded={true}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <span data-vc-breathe style={{
                width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0,
                boxShadow: `0 0 8px ${h.color}60`, animation: 'vc-breathe 3s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                vibe check
              </span>
            </div>
            <span style={{
              fontSize: 14, fontWeight: 500, color: h.color,
              background: `${h.color}15`, padding: '2px 8px', borderRadius: 6,
            }}>{mode === 'vibe' ? h.vibeLabel : h.label}</span>
          </div>

          <ModeToggle mode={mode} onToggle={toggleMode} />
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {/* Fixed body height keeps the panel a stable size as you switch tabs
            (short tabs no longer make it shrink and jump). Clamps on short
            viewports; content beyond it scrolls. */}
        <div data-testid="vibe-check-body" style={{ height: 'min(420px, calc(100vh - 168px))', overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 14px 10px' }}>

          {/* ── MONITOR VIEW ───────────────────────────────────────── */}
          {activeView === 'monitor' && (
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
              {/* FPS HERO */}
              {ps.has('fps') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <Ring value={snapshot.frameRate.fps} max={60} color={fc} size={58} />
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: fc,
                    }}>{Math.round(snapshot.frameRate.fps)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: T.textTertiary, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {mode === 'vibe' ? 'Smoothness' : 'Frame Rate'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: T.textTertiary }}>Avg</span>
                      <span style={{ color: T.textSecondary, textAlign: 'right' }}>{snapshot.frameRate.avgFrameTime.toFixed(1)}ms</span>
                      <span style={{ color: T.textTertiary }}>Worst</span>
                      <span style={{ color: snapshot.frameRate.maxFrameTime > 50 ? T.orange : T.textSecondary, textAlign: 'right' }}>{snapshot.frameRate.maxFrameTime.toFixed(1)}ms</span>
                      <span style={{ color: T.textTertiary }}>Smooth</span>
                      <span style={{ color: T.textSecondary, textAlign: 'right' }}>{snapshot.frameRate.smoothness.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* WEB VITALS */}
              {ps.has('vitals') && (
                <Section title={mode === 'vibe' ? 'Page Speed' : 'Web Vitals'}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['lcp', 'inp', 'cls'] as const).map((key) => {
                      const v = snapshot.webVitals[key]
                      const c = vitalColor(v?.rating)
                      const val = key === 'cls' ? (v ? v.value.toFixed(3) : '--') : (v ? fmtMs(v.value) : '--')
                      const vibeLabels: Record<string, string> = { lcp: 'load', inp: 'response', cls: 'stability' }
                      return (
                        <div key={key} data-vc-pill style={{
                          flex: 1, padding: '8px 6px 7px', textAlign: 'center', borderRadius: T.radiusSm,
                          background: T.bgSubtle,
                          border: `1px solid ${T.borderSubtle}`,
                          transition: 'background 0.3s ease, border-color 0.3s ease', cursor: 'default',
                        }}>
                          <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textTertiary, marginBottom: 4 }}>
                            {mode === 'vibe' ? vibeLabels[key] : key}
                          </div>
                          <div style={{
                            fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            color: v ? c : T.textMuted,
                          }}>{val}</div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* MEMORY + CONSOLE */}
              {(ps.has('memory') || ps.has('console')) && (
                <Section>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ps.has('memory') && (
                      <MetricCard
                        label={mode === 'vibe' ? 'Memory' : 'Heap'}
                        value={snapshot.memory ? `${snapshot.memory.jsHeapSizeMB.toFixed(0)}` : '--'}
                        unit="MB"
                        color={!snapshot.memory ? T.textMuted : snapshot.memory.usedPct > 80 ? T.red : snapshot.memory.usedPct > 60 ? T.yellow : T.text}
                        sub={snapshot.memory ? `${snapshot.memory.usedPct.toFixed(0)}% used` : 'Chrome only'}
                      />
                    )}
                    {ps.has('console') && (
                      <div style={{
                        flex: 1, padding: '8px 10px', borderRadius: T.radiusSm,
                        background: T.bgSubtle, border: `1px solid ${T.borderSubtle}`,
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textTertiary, marginBottom: 6 }}>
                          {mode === 'vibe' ? 'Errors' : 'Console'}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Dot count={snapshot.console.errorCount} color={T.red} label="err" />
                          <Dot count={snapshot.console.warnCount} color={T.yellow} label="wrn" />
                          <Dot count={snapshot.console.logCount} color={T.textTertiary} label="log" />
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* QUICK ISSUES SUMMARY */}
              {ps.has('issues') && (
                <Section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textTertiary }}>
                        {mode === 'vibe' ? 'Problems' : 'Issues'}
                      </span>
                      {activeCount > 0 && (
                        <span style={{
                          fontSize: 14, fontWeight: 700, color: T.text,
                          background: 'rgba(var(--vc-fg,255,255,255),0.08)', padding: '2px 7px', borderRadius: 6,
                          animation: 'vc-count-pop 0.3s ease',
                        }}>{activeCount}</span>
                      )}
                    </div>
                    {activeCount > 0 && (
                      <button
                        onClick={() => setActiveView('agent')}
                        style={{
                          fontSize: 14, fontWeight: 500,
                          color: T.textSecondary, background: T.bgSubtle,
                          border: `1px solid ${T.border}`, borderRadius: 6,
                          padding: '5px 11px', minHeight: 30, cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                          transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                        }}
                      >
                        {mode === 'vibe' ? 'fix with AI →' : 'view prompts →'}
                      </button>
                    )}
                  </div>
                  {activeCount === 0 ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      borderRadius: T.radiusSm, background: T.bgSubtle, border: `1px solid ${T.borderSubtle}`,
                    }}>
                      <span data-vc-breathe style={{
                        width: 8, height: 8, borderRadius: '50%', background: T.green,
                        boxShadow: `0 0 6px ${T.green}50`, animation: 'vc-breathe 3s ease-in-out infinite',
                      }} />
                      <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
                        {mode === 'vibe' ? 'All vibes are good' : 'No active issues'}
                      </span>
                    </div>
                  ) : (
                    <div style={{ borderRadius: T.radiusSm, background: T.bgSubtle, border: `1px solid ${T.borderSubtle}` }}>
                      {tracked.filter((t) => t.status === 'new').slice(0, 4).map((t, i, arr) => (
                        <QuickIssue key={t.issue.id} issue={t.issue} mode={mode} last={i === arr.length - 1} />
                      ))}
                      {activeCount > 4 && (
                        <button
                          onClick={() => setActiveView('agent')}
                          style={{
                            width: '100%', fontSize: 14, color: T.textSecondary, textAlign: 'center',
                            padding: '8px 0', minHeight: 36,
                            borderTop: `1px solid ${T.borderSubtle}`, cursor: 'pointer',
                            background: 'transparent', border: 'none', borderTopStyle: 'solid',
                            borderTopWidth: 1, borderTopColor: T.borderSubtle,
                            fontFamily: 'inherit', outline: 'none',
                          }}
                        >
                          +{activeCount - 4} more →
                        </button>
                      )}
                    </div>
                  )}
                </Section>
              )}
            </div>
          )}

          {/* ── AGENT VIEW ─────────────────────────────────────────── */}
          {activeView === 'agent' && (
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
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
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
              <AuditPanel
                tracked={tracked}
                detector="seo"
                heading="Discoverability"
                vibeHeading="Found online"
                subtitle="SEO, social-preview, and indexability checks."
                vibeSubtitle="How your page looks to Google and when shared on social."
                emptyLabel="All discoverability checks passed"
                vibeEmptyLabel="Your page is search & share ready"
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                onMarkSent={handleMarkSent}
              />
            </div>
          )}

          {/* ── AEO VIEW ──────────────────────────────────────────── */}
          {activeView === 'aeo' && (
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
              <AuditPanel
                tracked={tracked}
                detector="aeo"
                heading="AI readiness"
                vibeHeading="AI ready"
                subtitle="Can AI assistants & answer engines read, understand, and cite this page?"
                vibeSubtitle="How ready your page is for ChatGPT, Perplexity, Claude & friends."
                emptyLabel="Agent-ready — all checks passed"
                vibeEmptyLabel="Your page is AI-assistant ready"
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                onMarkSent={handleMarkSent}
              />
            </div>
          )}

          {/* ── PROMPTS VIEW ──────────────────────────────────────── */}
          {activeView === 'prompts' && (
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
              <PromptsPanel mode={mode} copiedId={copiedId} onCopy={copy} />
            </div>
          )}

          {/* ── SETTINGS VIEW ────────────────────────────────────── */}
          {activeView === 'settings' && (
            <div style={{ animation: 'vc-slide-in 0.2s ease' }}>
              <SettingsPanel prefs={prefs} onUpdate={updatePrefs} mode={mode} beaconUrl={beaconUrl} beaconStatus={beaconStatus} onClearAll={clearAll} />
            </div>
          )}
        </div>

        {/* ── Bottom navigation ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderTop: `1px solid ${T.borderSubtle}`,
          flexShrink: 0,
        }}>
          {TAB_CONFIG.map((tab) => {
            const active = activeView === tab.key
            const count = tab.key === 'agent' ? activeCount
              : tab.key === 'seo' ? seoCount
              : tab.key === 'aeo' ? aeoCount
              : 0
            return (
              <button
                key={tab.key}
                data-vc-tab
                style={navTabStyle(active)}
                onClick={() => setActiveView(tab.key)}
                aria-current={active ? 'page' : undefined}
              >
                {active && <span aria-hidden="true" style={NAV_INDICATOR} />}
                {mode === 'vibe' ? tab.vibeLabel : tab.label}
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

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div style={{ paddingTop: 12, marginTop: 4, borderTop: `1px solid ${T.borderSubtle}` }}>
    {title && <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textTertiary, marginBottom: 8 }}>{title}</div>}
    {children}
  </div>
)

const MetricCard = ({ label, value, unit, color, sub }: { label: string; value: string; unit: string; color: string; sub: string }) => (
  <div style={{
    flex: 1, padding: '8px 10px', borderRadius: T.radiusSm,
    background: T.bgSubtle, border: `1px solid ${T.borderSubtle}`,
  }}>
    <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.textTertiary }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, marginTop: 4, letterSpacing: '-0.02em', lineHeight: 1 }}>
      {value}<span style={{ fontSize: 14, fontWeight: 400, color: T.textMuted, marginLeft: 2 }}>{unit}</span>
    </div>
    <div style={{ fontSize: 14, color: T.textTertiary, marginTop: 4 }}>{sub}</div>
  </div>
)

const Dot = ({ count, color, label }: { count: number; color: string; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: count > 0 ? color : 'rgba(var(--vc-fg,255,255,255),0.08)',
      boxShadow: count > 0 ? `0 0 4px ${color}40` : 'none',
      transition: 'background 0.2s ease, box-shadow 0.2s ease',
    }} />
    <span style={{
      fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: count > 0 ? 600 : 400,
      color: count > 0 ? T.text : T.textMuted,
      transition: 'color 0.2s ease',
    }}>{count}</span>
    <span style={{ fontSize: 14, color: T.textTertiary }}>{label}</span>
  </div>
)

const QuickIssue = ({ issue, mode, last }: { readonly issue: VibeIssue; mode: string; last: boolean }) => {
  const SEV: Record<string, string> = { info: T.blue, warning: T.yellow, error: T.orange, critical: T.red }
  const c = SEV[issue.severity] ?? T.orange

  const vibeTitle = mode === 'vibe'
    ? issue.title.replace(/DOM/g, 'page elements').replace(/\bheap\b/gi, 'memory').replace(/\bCLS\b/g, 'layout shift')
    : issue.title

  return (
    <div style={{
      display: 'flex', gap: 8, padding: '8px 10px',
      borderBottom: last ? 'none' : `1px solid ${T.borderSubtle}`,
    }}>
      <div style={{
        width: 3, borderRadius: 2, flexShrink: 0, alignSelf: 'stretch', minHeight: 16,
        background: c,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: T.textSecondary, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{vibeTitle}</div>
      </div>
    </div>
  )
}
