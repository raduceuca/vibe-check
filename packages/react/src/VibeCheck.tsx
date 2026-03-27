import { useState, useCallback, useMemo, useEffect, useRef, type CSSProperties } from 'react'
import type { VibeIssue, VibeSnapshot } from '@wcgw/vibe-check-core'
import { useVibeCheck } from './hooks/useVibeCheck.js'
import { VibeCheckProvider } from './context.js'

type PanelType = 'fps' | 'vitals' | 'memory' | 'console' | 'issues'
type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface VibeCheckProps {
  readonly enabled?: boolean
  readonly position?: Position
  readonly panels?: readonly PanelType[]
  readonly beaconUrl?: string
  readonly onIssue?: (issue: VibeIssue) => void
}

// ── CSS Animations (injected once) ──────────────────────────────────────────

const STYLE_ID = 'vibe-check-styles'
const ANIMATIONS_CSS = `
@keyframes vc-breathe { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes vc-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vc-ring-in { from { stroke-dashoffset: var(--vc-circ); } }
@keyframes vc-pulse-glow { 0%,100% { box-shadow: 0 0 8px var(--vc-glow); } 50% { box-shadow: 0 0 16px var(--vc-glow), 0 0 24px var(--vc-glow-soft); } }
@keyframes vc-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes vc-count-pop { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
[data-vc-issue]:hover { background: rgba(255,255,255,0.03) !important; }
[data-vc-pill]:hover { background: rgba(255,255,255,0.06) !important; }
@media (prefers-reduced-motion: reduce) {
  [data-vc-breathe], [data-vc] * { animation: none !important; transition: none !important; }
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
  if (n > 3 || fps < 25) return { color: '#f87171', glow: 'rgba(248,113,113,0.25)', glowSoft: 'rgba(248,113,113,0.08)', label: 'critical', emoji: '' }
  if (n > 0 || fps < 40) return { color: '#fbbf24', glow: 'rgba(251,191,36,0.2)', glowSoft: 'rgba(251,191,36,0.06)', label: 'issues', emoji: '' }
  return { color: '#34d399', glow: 'rgba(52,211,153,0.2)', glowSoft: 'rgba(52,211,153,0.06)', label: 'healthy', emoji: '' }
}

// ── Colors ──────────────────────────────────────────────────────────────────

const fpsColor = (fps: number) => fps >= 55 ? '#34d399' : fps >= 40 ? '#fbbf24' : fps >= 25 ? '#fb923c' : '#f87171'
const vitalColor = (r?: string) => r === 'good' ? '#34d399' : r === 'needs-improvement' ? '#fbbf24' : '#f87171'
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
const SEV: Record<string, string> = { info: '#60a5fa', warning: '#fbbf24', error: '#fb923c', critical: '#f87171' }

// ── Position ────────────────────────────────────────────────────────────────

const POS: Record<Position, CSSProperties> = {
  'top-left': { top: 16, left: 16 }, 'top-right': { top: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 }, 'bottom-right': { bottom: 16, right: 16 },
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
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f87171" />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none"
        stroke={value / max > 0.65 ? color : `url(#${gid})`}
        strokeWidth={sw} strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${color}50)`, transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ── Mini ring for collapsed pill ────────────────────────────────────────────

const MiniRing = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const sw = 2; const size = 18; const r = (size - sw * 2) / 2; const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(value / max, 1)); const mid = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}60)`, transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  )
}

// ── FONT ────────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif'

// ── Main Component ──────────────────────────────────────────────────────────

const DEFAULT_PANELS: readonly PanelType[] = ['fps', 'vitals', 'memory', 'console', 'issues']

export const VibeCheck = ({
  enabled = true, position = 'bottom-right',
  panels = DEFAULT_PANELS,
  beaconUrl, onIssue,
}: VibeCheckProps) => {
  useAnimations()
  const [collapsed, setCollapsed] = useState(false)
  const config = useMemo(() => beaconUrl ? { beaconUrl } : undefined, [beaconUrl])
  const { engine, snapshot } = useVibeCheck(config, enabled)

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

  if (!enabled) return null
  const pos = POS[position]

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLAPSED — Floating pill with mini ring, breathing dot, ambient glow
  // ═══════════════════════════════════════════════════════════════════════════
  if (collapsed) {
    return (
      <div style={{ position: 'fixed', zIndex: 2147483647, ...pos }} data-testid="vibe-check-overlay" data-vc>
        <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header" data-vc-pill
          aria-label="Expand vibe check panel" aria-expanded={false}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px 5px 6px',
            fontFamily: FONT, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
            color: 'rgba(255,255,255,0.85)',
            background: 'linear-gradient(135deg, rgba(22,22,28,0.96), rgba(14,14,18,0.98))',
            borderRadius: 24, cursor: 'pointer', userSelect: 'none',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: `0 0 0 0.5px rgba(255,255,255,0.03), 0 6px 32px rgba(0,0,0,0.5), 0 0 20px ${h.glowSoft}`,
            backdropFilter: 'blur(24px) saturate(1.3)',
            animation: 'vc-fade-in 0.25s cubic-bezier(0.4,0,0.2,1)',
            '--vc-glow': h.glow, '--vc-glow-soft': h.glowSoft,
          } as CSSProperties}>
          <MiniRing value={snapshot.frameRate.fps} max={60} color={fpsColor(snapshot.frameRate.fps)} />
          <span style={{ fontWeight: 600 }}>{Math.round(snapshot.frameRate.fps)}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 400 }}>fps</span>
          {snapshot.issues.length > 0 && (
            <span style={{
              fontSize: 14, fontWeight: 600, color: h.color,
              background: `${h.color}18`, padding: '1px 5px', borderRadius: 6,
              marginLeft: 2,
            }}>{snapshot.issues.length}</span>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANDED — Full panel
  // ═══════════════════════════════════════════════════════════════════════════
  const fc = fpsColor(snapshot.frameRate.fps)

  return (
    <VibeCheckProvider value={engine}>
      <div data-testid="vibe-check-overlay" data-vc style={{
        position: 'fixed', zIndex: 2147483647, width: 300, fontFamily: FONT, fontSize: 14,
        color: 'rgba(255,255,255,0.85)', overflow: 'hidden',
        background: 'linear-gradient(165deg, rgba(22,22,30,0.96) 0%, rgba(10,10,14,0.98) 100%)',
        borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: `0 0 0 0.5px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 48px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.3), 0 0 40px ${h.glowSoft}`,
        backdropFilter: 'blur(32px) saturate(1.4)',
        animation: 'vc-fade-in 0.2s cubic-bezier(0.4,0,0.2,1)',
        ...pos,
      } as CSSProperties}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header"
          aria-label="Collapse vibe check panel" aria-expanded={true}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '11px 14px 10px', cursor: 'pointer', userSelect: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span data-vc-breathe style={{
              width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0,
              boxShadow: `0 0 8px ${h.color}80`, animation: 'vc-breathe 3s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: 'rgba(255,255,255,0.8)' }}>
              vibe check
            </span>
            <span style={{
              fontSize: 14, fontWeight: 500, color: h.color, opacity: 0.6,
              background: `${h.color}10`, padding: '1px 5px', borderRadius: 4,
              letterSpacing: '0.5px', textTransform: 'uppercase',
            }}>{h.label}</span>
          </div>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.15)', transition: 'transform 0.2s ease' }}>{'\u25B2'}</span>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div data-testid="vibe-check-body" style={{ padding: '10px 14px 14px' }}>

          {/* FPS HERO ─────────────────────────────────────────────── */}
          {ps.has('fps') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 10 }}>
              <div style={{ position: 'relative' }}>
                <Ring value={snapshot.frameRate.fps} max={60} color={fc} size={58} />
                {/* Center number inside ring */}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: fc,
                  textShadow: `0 0 10px ${fc}35`,
                }}>{Math.round(snapshot.frameRate.fps)}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
                  Frame Rate
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Avg</span>
                  <span style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{snapshot.frameRate.avgFrameTime.toFixed(1)}ms</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Worst</span>
                  <span style={{ color: snapshot.frameRate.maxFrameTime > 50 ? '#fb923c' : 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{snapshot.frameRate.maxFrameTime.toFixed(1)}ms</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Smooth</span>
                  <span style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{snapshot.frameRate.smoothness.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* WEB VITALS ───────────────────────────────────────────── */}
          {ps.has('vitals') && (
            <Section title="Web Vitals">
              <div style={{ display: 'flex', gap: 5 }}>
                {(['lcp', 'inp', 'cls'] as const).map((key) => {
                  const v = snapshot.webVitals[key]
                  const c = vitalColor(v?.rating)
                  const val = key === 'cls' ? (v ? v.value.toFixed(3) : '--') : (v ? fmtMs(v.value) : '--')
                  return (
                    <div key={key} data-vc-pill style={{
                      flex: 1, padding: '7px 4px 6px', textAlign: 'center', borderRadius: 10,
                      background: v ? `linear-gradient(160deg, ${c}0a, ${c}04)` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${v ? `${c}12` : 'rgba(255,255,255,0.04)'}`,
                      transition: 'all 0.3s ease', cursor: 'default',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: v ? `${c}90` : 'rgba(255,255,255,0.2)', marginBottom: 2 }}>
                        {key}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: v ? c : 'rgba(255,255,255,0.12)',
                        textShadow: v ? `0 0 10px ${c}20` : 'none',
                        letterSpacing: '-0.01em',
                      }}>{val}</div>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* MEMORY + CONSOLE ─────────────────────────────────────── */}
          {(ps.has('memory') || ps.has('console')) && (
            <Section>
              <div style={{ display: 'flex', gap: 6 }}>
                {ps.has('memory') && (
                  <MetricCard
                    label="Heap"
                    value={snapshot.memory ? `${snapshot.memory.jsHeapSizeMB.toFixed(0)}` : '--'}
                    unit="MB"
                    color={!snapshot.memory ? 'rgba(255,255,255,0.12)' : snapshot.memory.usedPct > 80 ? '#f87171' : snapshot.memory.usedPct > 60 ? '#fbbf24' : 'rgba(255,255,255,0.7)'}
                    sub={snapshot.memory ? `${snapshot.memory.usedPct.toFixed(0)}% used` : 'Chrome only'}
                  />
                )}
                {ps.has('console') && (
                  <div style={{
                    flex: 1, padding: '7px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 5 }}>Console</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Dot count={snapshot.console.errorCount} color="#f87171" label="err" />
                      <Dot count={snapshot.console.warnCount} color="#fbbf24" label="wrn" />
                      <Dot count={snapshot.console.logCount} color="rgba(255,255,255,0.35)" label="log" />
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ISSUES ────────────────────────────────────────────────── */}
          {ps.has('issues') && (
            <Section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>Issues</span>
                {snapshot.issues.length > 0 && (
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: h.color,
                    background: `${h.color}15`, padding: '1px 6px', borderRadius: 8,
                    animation: 'vc-count-pop 0.3s ease',
                  }}>{snapshot.issues.length}</span>
                )}
              </div>
              {snapshot.issues.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  borderRadius: 10, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.08)',
                }}>
                  <span data-vc-breathe style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#34d399',
                    boxShadow: '0 0 8px rgba(52,211,153,0.5)', animation: 'vc-breathe 3s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: 14, color: '#34d399', fontWeight: 500 }}>All vibes are good</span>
                </div>
              ) : (
                <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {snapshot.issues.slice(0, 8).map((issue, i) => (
                    <Issue key={issue.id} issue={issue} last={i === Math.min(snapshot.issues.length, 8) - 1} />
                  ))}
                  {snapshot.issues.length > 8 && (
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      +{snapshot.issues.length - 8} more
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </VibeCheckProvider>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <div style={{ paddingTop: 10, marginTop: 2, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
    {title && <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)', marginBottom: 6 }}>{title}</div>}
    {children}
  </div>
)

const MetricCard = ({ label, value, unit, color, sub }: { label: string; value: string; unit: string; color: string; sub: string }) => (
  <div style={{
    flex: 1, padding: '7px 10px', borderRadius: 10,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, marginTop: 2, letterSpacing: '-0.02em', lineHeight: 1 }}>
      {value}<span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>{unit}</span>
    </div>
    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>{sub}</div>
  </div>
)

const Dot = ({ count, color, label }: { count: number; color: string; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: count > 0 ? color : 'rgba(255,255,255,0.06)',
      boxShadow: count > 0 ? `0 0 6px ${color}50` : 'none',
      transition: 'all 0.2s ease',
    }} />
    <span style={{
      fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: count > 0 ? 600 : 400,
      color: count > 0 ? color : 'rgba(255,255,255,0.12)',
      transition: 'color 0.2s ease',
    }}>{count}</span>
    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.15)' }}>{label}</span>
  </div>
)

const Issue = ({ issue, last }: { readonly issue: VibeIssue; last: boolean }) => {
  const [expanded, setExpanded] = useState(false)
  const c = SEV[issue.severity] ?? '#fb923c'
  const isCrit = issue.severity === 'critical'

  return (
    <div data-vc-issue onClick={() => setExpanded((p) => !p)} role="button" tabIndex={0}
      aria-label={`Toggle details for ${issue.title}`} aria-expanded={expanded}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((p) => !p) } }}
      style={{
        display: 'flex', gap: 8, padding: '7px 10px',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer', transition: 'background 0.15s ease',
      }}>
      <div style={{
        width: 3, borderRadius: 2, flexShrink: 0, alignSelf: 'stretch', minHeight: 16,
        background: c, boxShadow: `0 0 ${isCrit ? 6 : 4}px ${c}${isCrit ? '60' : '35'}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{issue.title}</div>
        {expanded && (
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.55,
            animation: 'vc-fade-in 0.15s ease',
          }}>{issue.description}</div>
        )}
      </div>
      <span style={{
        fontSize: 14, color: 'rgba(255,255,255,0.12)', alignSelf: 'flex-start', marginTop: 3,
        transition: 'transform 0.15s ease', transform: expanded ? 'rotate(180deg)' : 'none',
      }}>{'\u25BC'}</span>
    </div>
  )
}
