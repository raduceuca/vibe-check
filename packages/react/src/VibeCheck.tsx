import { useState, useCallback, useMemo, useEffect, useRef, memo, type CSSProperties } from 'react'
import type { VibeIssue, BeaconStatus, DispatchIssueResponse, VibeEngine } from '@wcgw/vibe-check-core'
import { useVibeCheck } from './hooks/useVibeCheck.js'
import { useIssueStore } from './hooks/useIssueStore.js'
import { usePreferences } from './hooks/usePreferences.js'
import { useClipboard } from './hooks/useClipboard.js'
import { useFpsHistory } from './hooks/useFpsHistory.js'
import { VibeCheckProvider } from './context.js'
import { T } from './tokens.js'
import { useAnimations } from './theme.js'
import type { PanelType, Position, ViewTab } from './panels/types.js'
import { getHealth, healthKey, sevVar, sevGlow } from './panels/monitor/severity.js'
import { surfaceStyle } from './panels/ui/surface.js'
import { CollapsedPill } from './panels/CollapsedPill.js'
import { MonitorView } from './panels/monitor/MonitorView.js'
import { BottomNav } from './panels/nav/BottomNav.js'
import { AgentPanel } from './panels/AgentPanel.js'
import { PromptsPanel } from './panels/PromptsPanel.js'
import { SettingsPanel } from './panels/SettingsPanel.js'
import { AuditPanel } from './panels/AuditPanel.js'
import { AnnotationOverlay } from './panels/AnnotationOverlay.js'
import { getAgentDisplayState } from './panels/AgentConnectionStatus.js'

export interface VibeCheckProps {
  readonly enabled?: boolean
  readonly position?: Position
  readonly panels?: readonly PanelType[]
  readonly beaconUrl?: string
  readonly projectId?: string
  readonly onIssue?: (issue: VibeIssue) => void
  // Drive a provided engine (e.g. createScriptedEngine(...)) instead of a live
  // one — for deterministic scripted demos. Omit for normal behaviour.
  readonly engine?: VibeEngine | null
  // Start collapsed (as a floating pill). Lets a wrapper (PerfToggle) make
  // first-run discoverable without opening the full panel.
  readonly startCollapsed?: boolean
  // Distinct localStorage bucket for preferences — set per instance so multiple
  // embeds on one page don't collide.
  readonly storageKey?: string
}

const POS: Record<Position, CSSProperties> = {
  'top-left': { top: 12, left: 12 }, 'top-right': { top: 12, right: 12 },
  'bottom-left': { bottom: 12, left: 12 }, 'bottom-right': { bottom: 12, right: 12 },
}

const DEFAULT_PANELS: readonly PanelType[] = ['fps', 'vitals', 'memory', 'console', 'issues']

// The widget shell: owns engine + preferences + issue state, and routes between
// the collapsed pill and the expanded panel's views. Each view is its own
// component; presentational pieces live under panels/ (ui, monitor, nav).
export const VibeCheck = memo(({
  enabled = true, position = 'bottom-right',
  panels = DEFAULT_PANELS,
  beaconUrl, projectId, onIssue,
  engine: providedEngine = null,
  startCollapsed = false,
  storageKey,
}: VibeCheckProps) => {
  useAnimations()
  const [collapsed, setCollapsed] = useState(startCollapsed)
  const [activeView, setActiveView] = useState<ViewTab>('monitor')
  const config = useMemo(() => beaconUrl ? { beaconUrl, projectId } : undefined, [beaconUrl, projectId])
  const { engine, snapshot } = useVibeCheck(config, enabled, providedEngine)
  const { prefs, updatePrefs, toggleMode } = usePreferences(storageKey)
  const { copiedId, copy } = useClipboard()
  const { tracked, markSent, markResolved, clearResolved, clearAll } = useIssueStore(snapshot.issues)
  const mode = prefs.mode

  // ── Focus management ───────────────────────────────────────────────────────
  // On a real toggle, move focus to the counterpart control (panel header on
  // expand, pill on collapse) so a keyboard user isn't dropped to <body>.
  const pillRef = useRef<HTMLDivElement>(null)
  const panelHeaderRef = useRef<HTMLDivElement>(null)
  const didMountRef = useRef(false)
  const prevCollapsedRef = useRef(collapsed)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      prevCollapsedRef.current = collapsed
      return
    }
    if (prevCollapsedRef.current !== collapsed) {
      if (collapsed) pillRef.current?.focus()
      else panelHeaderRef.current?.focus()
      prevCollapsedRef.current = collapsed
    }
  }, [collapsed])
  // Honest performance lifeline — accrues even while collapsed.
  const fpsHistory = useFpsHistory(snapshot.frameRate.fps, snapshot.timestamp, prefs.keepHistory)

  // Real beacon delivery status, re-read each snapshot tick (~500ms) so the
  // settings indicator reflects whether snapshots actually reach the MCP server
  // rather than merely "a beaconUrl is configured". Null when no beacon.
  const beaconStatus: BeaconStatus | null = beaconUrl ? (engine?.getBeaconStatus() ?? null) : null
  const agentConnectionState = getAgentDisplayState(beaconUrl, beaconStatus)

  // "Clear annotations on send": when enabled, hide the on-page markers as
  // issues are dispatched to the agent. Wrap the mark-sent handlers so the
  // toggle has a real effect (previously it was persisted but never read).
  const handleMarkSent = useCallback((issueId: string) => {
    markSent(issueId)
    if (prefs.clearOnSend) updatePrefs({ annotationsVisible: false })
  }, [markSent, prefs.clearOnSend, updatePrefs])

  const handleDispatch = useCallback((issue: VibeIssue): Promise<DispatchIssueResponse> => {
    if (engine) return engine.dispatchIssue(issue)
    return Promise.resolve({
      ok: false,
      code: 'unconfigured',
      projectId: projectId ?? 'unknown-project',
      queueDepth: 0,
    })
  }, [engine, projectId])

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

  const hKey = healthKey(snapshot)
  const hColor = sevVar(hKey)

  const activeCount = tracked.filter((t) => t.status === 'new').length
  const seoCount = tracked.filter((t) => t.issue.detector === 'seo' && t.status === 'new').length
  const aeoCount = tracked.filter((t) => t.issue.detector === 'aeo' && t.status === 'new').length
  // Stable identity so React.memo(BottomNav) skips re-render on pure FPS ticks.
  const navCounts = useMemo(
    () => ({ agent: activeCount, seo: seoCount, aeo: aeoCount }),
    [activeCount, seoCount, aeoCount],
  )

  if (!enabled) return null
  const pos = POS[position]

  const annotationOverlay = (
    <AnnotationOverlay
      tracked={tracked}
      visible={prefs.annotationsVisible && !collapsed}
      mode={mode}
      theme={prefs.theme}
      copiedId={copiedId}
      onCopy={copy}
      onMarkResolved={markResolved}
    />
  )

  // ── Collapsed — floating pill ──────────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        {annotationOverlay}
        <CollapsedPill snapshot={snapshot} activeCount={activeCount} onToggle={toggle} theme={prefs.theme} mode={mode} pos={pos} headerRef={pillRef} />
      </>
    )
  }

  // ── Expanded — full panel with tabbed navigation ───────────────────────────
  return (
    <VibeCheckProvider value={engine}>
      {annotationOverlay}
      <div
        data-testid="vibe-check-overlay" data-wcgw data-wcgw-theme={prefs.theme}
        role="complementary" aria-label="Vibe check performance monitor"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCollapsed(true) } }}
        style={{
          ...surfaceStyle,
          position: 'fixed', zIndex: T.zPanel, width: 320, maxWidth: 'calc(100vw - 24px)', fontFamily: T.font, fontSize: 14,
          color: T.text, overflow: 'hidden',
          borderRadius: T.radiusXl,
          animation: `vc-fade-in ${T.durationNormal} ${T.ease}`,
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
            <div ref={panelHeaderRef} onClick={toggle} role="button" tabIndex={0} data-testid="vibe-check-header"
              aria-label="Collapse vibe check panel" aria-expanded={true}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <span data-wcgw-breathe style={{
                width: 8, height: 8, borderRadius: T.radiusPill, background: hColor, flexShrink: 0,
                boxShadow: `0 0 8px ${sevGlow(hKey)}`, animation: 'vc-breathe 3s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                vibe check
              </span>
            </div>
            <span style={{
              fontSize: 14, fontWeight: 500, color: h.labelColor,
              background: `color-mix(in srgb, ${h.labelColor} 14%, transparent)`, padding: '2px 8px', borderRadius: T.radiusSm,
            }}>{mode === 'vibe' ? h.vibeLabel : h.label}</span>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {/* Fixed body height keeps the panel a stable size as you switch tabs
            (short tabs no longer make it shrink and jump). Clamps on short
            viewports; content beyond it scrolls. */}
        <div data-testid="vibe-check-body" style={{ height: 'min(420px, calc(100vh - 168px))', overflowY: 'auto', overscrollBehavior: 'contain', padding: '10px 16px 14px' }}>

          {activeView === 'monitor' && (
            <MonitorView snapshot={snapshot} mode={mode} tracked={tracked} panels={ps} theme={prefs.theme} history={fpsHistory} onOpenView={setActiveView} />
          )}

          {activeView === 'agent' && (
            <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
              <AgentPanel
                tracked={tracked}
                mode={mode}
                copiedId={copiedId}
                onCopy={copy}
                beaconUrl={beaconUrl}
                beaconStatus={beaconStatus}
                onDispatch={handleDispatch}
                onMarkSent={handleMarkSent}
                onMarkResolved={markResolved}
                onClearResolved={clearResolved}
              />
            </div>
          )}

          {activeView === 'seo' && (
            <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
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
              />
            </div>
          )}

          {activeView === 'aeo' && (
            <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
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
              />
            </div>
          )}

          {activeView === 'prompts' && (
            <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
              <PromptsPanel mode={mode} copiedId={copiedId} onCopy={copy} />
            </div>
          )}

          {activeView === 'settings' && (
            <div style={{ animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
              <SettingsPanel prefs={prefs} onUpdate={updatePrefs} mode={mode} onToggleMode={toggleMode} beaconUrl={beaconUrl} beaconStatus={beaconStatus} onClearAll={clearAll} />
            </div>
          )}
        </div>

        {/* ── Bottom navigation ───────────────────────────────────────── */}
        <BottomNav
          activeView={activeView}
          onSelect={setActiveView}
          mode={mode}
          counts={navCounts}
          agentConnectionState={agentConnectionState}
        />
      </div>
    </VibeCheckProvider>
  )
})
