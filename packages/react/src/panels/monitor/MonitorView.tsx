import { useState, lazy, Suspense, memo, type CSSProperties } from 'react'
import type { LivelinePoint } from 'liveline'
import type { ProjectImpactSummary, VibeSnapshot, VibeIssue } from '@wcgw/vibe-check-core'
import { SEO_CRITERIA_COUNT, AEO_CRITERIA_COUNT } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import type { FpsHistory, FpsSample } from '../../hooks/useFpsHistory.js'
import type { PanelType, ViewTab } from '../types.js'
import { T } from '../../tokens.js'
import { getSuggestionCached } from '../suggestionCache.js'

// The FPS chart is ~62KB (liveline). Load it lazily so the collapsed pill and the
// initial load skip it — it only renders when the panel is expanded on Monitor
// and the browser has a working canvas (CANVAS_OK).
const Liveline = lazy(() => import('liveline').then((m) => ({ default: m.Liveline })))
import {
  DISPLAY_PX, T_UNIT, T_LABEL, FINE, DIVIDER, SUBKICKER, KICKER,
  STAT_GRID, STAT_VALUE, STAT_LABEL,
} from '../ui/typography.js'
import { auditScore, gradeFor, scoreColor } from '../ui/ScoreRing.js'
import { Stat } from '../ui/Stat.js'
import { LinkButton } from '../ui/LinkButton.js'
import { Tabs } from '../ui/Tabs.js'
import { sevVar, sevHex, sevGlow, fpsKey, vitalKey, fmtMs } from './severity.js'
import { FpsTrace, WINDOW_OPTIONS, CANVAS_OK } from './FpsTrace.js'
import { ImpactCard } from '../ImpactCard.js'

// Visually-hidden text — announced to screen readers, off-screen visually.
const SR_ONLY: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

// Honour the OS reduced-motion setting for the rAF-driven Liveline (the CSS
// reduced-motion rule can't reach its canvas animation).
const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── Colocated leaf cells ─────────────────────────────────────────────────────

const ConsoleStat = ({ count, color, label }: { count: number; color: string; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 5, height: 5, borderRadius: T.radiusPill, background: count > 0 ? color : 'rgba(var(--wcgw-fg),0.15)', flexShrink: 0 }} />
    <span style={{ color: count > 0 ? T.textSecondary : T.textMuted, fontWeight: count > 0 ? 600 : 400 }}>{count}</span>
    <span style={{ color: T.textTertiary }}>{label}</span>
  </span>
)

// Compact audit score cell — value + grade over a label; click jumps to the tab.
const AuditScoreChip = ({ label, score, onClick }: { label: string; score: number; onClick: () => void }) => {
  const c = scoreColor(score)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} score ${score}, grade ${gradeFor(score)} — open ${label} audit`}
      style={{
        minWidth: 0, display: 'block', textAlign: 'left', padding: 0,
        background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div aria-hidden="true" style={{ ...STAT_VALUE, gap: 5, color: c }}>
        {score}<span style={{ fontWeight: 600 }}>{gradeFor(score)}</span>
      </div>
      <div aria-hidden="true" style={STAT_LABEL}>{label}</div>
    </button>
  )
}

const SEV_TICK: Record<string, string> = {
  info: 'var(--wcgw-sev-info)',
  warning: 'var(--wcgw-sev-warning)',
  error: 'var(--wcgw-sev-error)',
  critical: 'var(--wcgw-sev-critical)',
}

const QuickIssue = ({ issue, mode }: { readonly issue: VibeIssue; mode: string }) => {
  const c = SEV_TICK[issue.severity] ?? SEV_TICK['error']
  // Use the real vibe copy (same source as the Agent tab) instead of ad-hoc regex
  // rewrites, so Monitor and Agent always agree on an issue's name.
  const title = mode === 'vibe' ? getSuggestionCached(issue, 'vibe').title : issue.title

  return (
    <div style={{ display: 'flex', gap: 9, padding: '5px 0', alignItems: 'stretch' }}>
      <span aria-hidden="true" style={{ width: 3, minHeight: 15, borderRadius: T.radiusXs, background: c, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: T.textSecondary, alignSelf: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}><span style={SR_ONLY}>{issue.severity}: </span>{title}</span>
    </div>
  )
}

// ── Monitor view ─────────────────────────────────────────────────────────────

interface MonitorViewProps {
  readonly snapshot: VibeSnapshot
  readonly mode: string
  readonly tracked: readonly TrackedIssue[]
  readonly panels: ReadonlySet<PanelType>
  readonly theme: 'dark' | 'light'
  readonly history: FpsHistory
  readonly onOpenView: (v: ViewTab) => void
  readonly impact?: ProjectImpactSummary | null
}

export const MonitorView = memo(({
  snapshot, mode, tracked, panels, theme, history, onOpenView, impact = null,
}: MonitorViewProps) => {
  const [chartWindow, setChartWindow] = useState(30)
  // Live/5m read the full-res buffer; 15m/1h read the coarse one.
  const chartData = chartWindow <= 300 ? history.live : history.long
  const isLight = theme === 'light'
  const fc = sevHex(fpsKey(snapshot.frameRate.fps), isLight)
  const reduced = prefersReducedMotion()

  // Text alternative for the canvas lifeline (SRs perceive nothing on a <canvas>).
  const fpsNow = Math.round(snapshot.frameRate.fps)
  const worstFps = chartData.reduce<number>((m, p) => Math.min(m, (p as FpsSample).value), fpsNow)
  const windowLabel = WINDOW_OPTIONS.find((o) => o.secs === chartWindow)?.label ?? 'live'
  const chartAria = `FPS over the last ${windowLabel}, currently ${fpsNow}, worst ${Number.isFinite(worstFps) ? worstFps : fpsNow}`

  const activeCount = tracked.filter((t) => t.status === 'new').length
  // Audit scores for the dashboard chips — unresolved findings vs total criteria.
  const seoScore = auditScore(SEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'seo' && t.status !== 'resolved').length)
  const aeoScore = auditScore(AEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'aeo' && t.status !== 'resolved').length)

  return (
    <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
      {/* FPS HERO — quiet numeral + avg/worst + live trace */}
      {panels.has('fps') && (
        <div style={{ paddingBottom: 14 }}>
          {/* Main metric — FPS, left-aligned */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: DISPLAY_PX, fontWeight: 600, lineHeight: 1, color: T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{Math.round(snapshot.frameRate.fps)}</span>
            <span style={T_UNIT}>fps</span>
          </div>
          <div style={{ ...T_UNIT, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
            avg {snapshot.frameRate.avgFrameTime.toFixed(1)}ms · worst <span style={{ color: snapshot.frameRate.maxFrameTime > 50 ? sevVar('error') : T.textSecondary }}>{snapshot.frameRate.maxFrameTime.toFixed(0)}ms</span>
          </div>

          {/* Secondary metrics — stacked under the FPS, left-aligned, fine separation */}
          {(panels.has('vitals') || panels.has('memory')) && (
            <div style={{ ...FINE, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
              {panels.has('vitals') && (['lcp', 'inp', 'cls'] as const).map((key) => {
                const v = snapshot.webVitals[key]
                const poor = !!v && v.rating !== 'good'
                const val = key === 'cls' ? (v ? v.value.toFixed(3) : '—') : (v ? fmtMs(v.value) : '—')
                const vibeLabels: Record<string, string> = { lcp: 'load', inp: 'response', cls: 'stability' }
                return (
                  <Stat key={key} label={mode === 'vibe' ? vibeLabels[key] : key} value={val} color={!v ? T.textMuted : poor ? sevVar(vitalKey(v.rating)) : T.text} />
                )
              })}
              {panels.has('memory') && (
                <Stat
                  label={mode === 'vibe' ? 'mem' : 'heap'}
                  value={snapshot.memory ? `${snapshot.memory.jsHeapSizeMB.toFixed(0)} MB` : 'n/a'}
                  color={snapshot.memory ? (snapshot.memory.usedPct > 80 ? sevVar('critical') : snapshot.memory.usedPct > 60 ? sevVar('warning') : T.text) : T.textMuted}
                />
              )}
            </div>
          )}
          {/* The lifeline — the one prominent accent. Parent sets the height.
              role=img + computed label gives the canvas a text alternative; the
              left fade masks axis labels that would otherwise clip mid-glyph. */}
          <div role="img" aria-label={chartAria} style={{ position: 'relative', marginTop: 12, height: 96 }}>
            {CANVAS_OK ? (
              <Suspense fallback={<div style={{ width: '100%', height: '100%' }} />}>
                <Liveline
                  data={chartData as unknown as LivelinePoint[]}
                  value={Math.round(snapshot.frameRate.fps)}
                  theme={theme}
                  color={fc}
                  window={chartWindow}
                  lineWidth={2}
                  fill
                  pulse={!reduced}
                  grid={false}
                  badge={false}
                  scrub={false}
                  momentum={false}
                  showValue={false}
                  exaggerate={false}
                  referenceLine={{ value: 60 }}
                  emptyText="measuring…"
                />
              </Suspense>
            ) : (
              <FpsTrace fps={snapshot.frameRate.fps} tick={snapshot.timestamp} color={fc} faulted={activeCount > 0} />
            )}
            <span aria-hidden="true" style={{
              position: 'absolute', top: 0, left: 0, width: 16, height: '100%',
              background: 'linear-gradient(to right, var(--wcgw-bg), transparent)',
              pointerEvents: 'none',
            }} />
          </div>
          {/* Timescale selector — live / 5m / 15m / 1h (segmented pills) */}
          {CANVAS_OK && (
            <Tabs
              items={WINDOW_OPTIONS.map((o) => ({ key: String(o.secs), content: o.label }))}
              activeKey={String(chartWindow)}
              onSelect={(k) => setChartWindow(Number(k))}
              variant="pill"
              fill={false}
              ariaLabel="Chart time window"
              containerStyle={{ gap: 2, justifyContent: 'flex-start', marginTop: 4 }}
            />
          )}
        </div>
      )}

      {impact && (
        <ImpactCard impact={impact} compact onCopy={() => undefined} />
      )}

      {/* AUDITS — SEO + AEO scores on the same grid; click opens the tab */}
      <div style={{ ...DIVIDER, paddingBottom: 14 }}>
        <div style={SUBKICKER}>audits</div>
        {/* Two chips only — a 2-col grid (not the 3-col STAT_GRID) so the vibe
            label never truncates at the panel's default 320px width. */}
        <div style={{ ...STAT_GRID, gridTemplateColumns: '1fr 1fr' }}>
          <AuditScoreChip label={mode === 'vibe' ? 'search' : 'seo'} score={seoScore} onClick={() => onOpenView('seo')} />
          <AuditScoreChip label={mode === 'vibe' ? 'answers' : 'aeo'} score={aeoScore} onClick={() => onOpenView('aeo')} />
        </div>
      </div>

      {/* ISSUES — count heading + borderless tick rows */}
      {panels.has('issues') && (
        <div style={DIVIDER}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={KICKER}>
              {mode === 'vibe' ? 'problems' : 'issues'}
              {activeCount > 0 && <span style={{ color: T.textSecondary, marginLeft: 6, fontWeight: 600 }}>{activeCount}</span>}
            </div>
            {activeCount > 0 && (
              <LinkButton onClick={() => onOpenView('agent')}>
                {mode === 'vibe' ? 'fix with AI →' : 'view prompts →'}
              </LinkButton>
            )}
          </div>
          {/* Console breakdown — these problems come from the console log */}
          {panels.has('console') && (
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
                width: 7, height: 7, borderRadius: T.radiusPill, background: sevVar('success'),
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
                <LinkButton onClick={() => onOpenView('agent')} style={{ marginTop: 4 }}>
                  +{activeCount - 4} more →
                </LinkButton>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
