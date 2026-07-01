import { useState } from 'react'
import { Liveline, type LivelinePoint } from 'liveline'
import type { VibeSnapshot, VibeIssue } from '@wcgw/vibe-check-core'
import { SEO_CRITERIA_COUNT, AEO_CRITERIA_COUNT } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import type { FpsHistory } from '../../hooks/useFpsHistory.js'
import type { PanelType, ViewTab } from '../types.js'
import { T } from '../../tokens.js'
import {
  DISPLAY_PX, T_UNIT, T_LABEL, FINE, DIVIDER, SUBKICKER, KICKER,
  STAT_GRID, STAT_VALUE, STAT_LABEL, QUIET_LINK,
} from '../ui/typography.js'
import { auditScore, gradeFor, scoreColor } from '../ui/ScoreRing.js'
import { Stat } from '../ui/Stat.js'
import { sevVar, sevHex, sevGlow, fpsKey, vitalKey, fmtMs } from './severity.js'
import { FpsTrace, WINDOW_OPTIONS, winBtnStyle, CANVAS_OK } from './FpsTrace.js'

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
      <span style={{ width: 3, minHeight: 15, borderRadius: T.radiusXs, background: c, flexShrink: 0 }} />
      <span style={{
        flex: 1, minWidth: 0, fontSize: 14, color: T.textSecondary, alignSelf: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{vibeTitle}</span>
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
}

export const MonitorView = ({ snapshot, mode, tracked, panels, theme, history, onOpenView }: MonitorViewProps) => {
  const [chartWindow, setChartWindow] = useState(30)
  // Live/5m read the full-res buffer; 15m/1h read the coarse one.
  const chartData = chartWindow <= 300 ? history.live : history.long
  const isLight = theme === 'light'
  const fc = sevHex(fpsKey(snapshot.frameRate.fps), isLight)

  const activeCount = tracked.filter((t) => t.status === 'new').length
  // Audit scores for the dashboard chips — unresolved findings vs total criteria.
  const seoScore = auditScore(SEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'seo' && t.status !== 'resolved').length)
  const aeoScore = auditScore(AEO_CRITERIA_COUNT, tracked.filter((t) => t.issue.detector === 'aeo' && t.status !== 'resolved').length)

  return (
    <div style={{ animation: 'vc-fade-in 0.18s ease' }}>
      {/* FPS HERO — quiet numeral + avg/worst + live trace */}
      {panels.has('fps') && (
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
          {/* The lifeline — the one prominent accent. Parent sets the height. */}
          <div style={{ marginTop: 12, height: 96 }}>
            {CANVAS_OK ? (
              <Liveline
                data={chartData as unknown as LivelinePoint[]}
                value={Math.round(snapshot.frameRate.fps)}
                theme={theme}
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
          <AuditScoreChip label={mode === 'vibe' ? 'search' : 'seo'} score={seoScore} onClick={() => onOpenView('seo')} />
          <AuditScoreChip label={mode === 'vibe' ? 'ai answers' : 'aeo'} score={aeoScore} onClick={() => onOpenView('aeo')} />
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
              <button onClick={() => onOpenView('agent')} style={QUIET_LINK}>
                {mode === 'vibe' ? 'fix with AI →' : 'view prompts →'}
              </button>
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
                <button onClick={() => onOpenView('agent')} style={{ ...QUIET_LINK, marginTop: 4 }}>
                  +{activeCount - 4} more →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
