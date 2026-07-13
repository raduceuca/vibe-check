import { memo, type CSSProperties, type Ref } from 'react'
import type { VibeSnapshot, SuggestionMode } from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'
import { MiniRing } from './monitor/MiniRing.js'
import { getHealth, healthKey, sevVar, sevGlow, fpsKey } from './monitor/severity.js'
import { ProofRail } from './ui/ProofRail.js'

// Thin separator between the pill's metric groups.
const PillDivider = () => (
  <span aria-hidden="true" style={{ width: 1, height: 13, background: 'rgba(var(--wcgw-fg),0.12)', flexShrink: 0, margin: '0 1px' }} />
)

interface CollapsedPillProps {
  readonly snapshot: VibeSnapshot
  readonly activeCount: number
  readonly onToggle: () => void
  readonly theme: 'dark' | 'light'
  readonly mode: SuggestionMode
  readonly pos: CSSProperties
  // Focus target so the panel can restore focus to the pill on collapse/Escape.
  readonly headerRef?: Ref<HTMLDivElement>
}

// The floating pill shown when the panel is collapsed — health dot, FPS ring,
// memory, and an issue count. Self-contained: derives its own health/accent.
export const CollapsedPill = memo(({ snapshot, activeCount, onToggle, theme, mode, pos, headerRef }: CollapsedPillProps) => {
  const h = getHealth(snapshot)
  const hKey = healthKey(snapshot)
  const hColor = sevVar(hKey)
  const noun = mode === 'vibe'
    ? (activeCount === 1 ? 'problem' : 'problems')
    : (activeCount === 1 ? 'issue' : 'issues')

  return (
    <div style={{ position: 'fixed', zIndex: T.zPanel, ...pos }} data-testid="vibe-check-overlay" data-wcgw data-wcgw-theme={theme}>
      <div ref={headerRef} onClick={onToggle} role="button" tabIndex={0} data-testid="vibe-check-header" data-wcgw-pill
        aria-label={`Expand vibe check — ${Math.round(snapshot.frameRate.fps)} fps, ${activeCount} ${noun}`} aria-expanded={false}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 13px 9px 11px', minHeight: 44,
          fontFamily: T.font, fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
          WebkitFontSmoothing: 'antialiased',
          color: T.text,
          background: T.bg,
          borderRadius: T.radiusPill, cursor: 'pointer', userSelect: 'none',
          border: `1px solid ${T.border}`,
          boxShadow: `var(--wcgw-shadow-md), 0 0 0 0.5px rgba(var(--wcgw-fg),0.04)`,
          animation: `vc-fade-in ${T.durationNormal} ${T.ease}`,
          position: 'relative',
        }}>
        <span style={{ position: 'absolute', top: 6, right: 12, lineHeight: 0 }}>
          <ProofRail compact faulted={activeCount > 0} />
        </span>
        {/* Overall health */}
        <span data-wcgw-breathe aria-hidden="true" style={{
          width: 8, height: 8, borderRadius: T.radiusPill, background: hColor, flexShrink: 0,
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
              background: `color-mix(in srgb, ${h.labelColor} 16%, transparent)`, padding: '1px 7px', borderRadius: T.radiusSm,
            }}>{activeCount}</span>
          </>
        )}
      </div>
    </div>
  )
})
