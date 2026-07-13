import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { Gauge, Wrench, MagnifyingGlass, Robot, Lightbulb, SlidersHorizontal } from '@phosphor-icons/react'
import { T } from '../../tokens.js'
import { Tabs, type TabItem } from '../ui/Tabs.js'
import type { ViewTab } from '../types.js'
import {
  AGENT_DISPLAY_COLORS,
  AGENT_DISPLAY_DESCRIPTIONS,
  type AgentDisplayState,
} from '../AgentConnectionStatus.js'

// vibeLabel is the tooltip/aria label in vibe mode (the tabs are icon-only, so
// the label is the ONLY text a hover/SR gets). devTitle expands the acronym tabs
// in dev mode.
const TAB_CONFIG: readonly {
  readonly key: ViewTab
  readonly label: string
  readonly vibeLabel: string
  readonly devTitle?: string
}[] = [
  { key: 'monitor', label: 'Monitor', vibeLabel: 'Stats' },
  { key: 'agent', label: 'Agent', vibeLabel: 'Fix' },
  { key: 'seo', label: 'SEO', vibeLabel: 'SEO', devTitle: 'SEO — search visibility' },
  { key: 'aeo', label: 'AEO', vibeLabel: 'AEO', devTitle: 'AEO — AI answer readiness (Answer Engine Optimization)' },
  { key: 'prompts', label: 'Prompts', vibeLabel: 'Ask AI' },
  { key: 'settings', label: 'Settings', vibeLabel: 'Settings' },
]

// Count dot for icon tabs — sits at the upper-right of the centered icon.
const NAV_DOT: CSSProperties = {
  position: 'absolute', top: 9, left: 'calc(50% + 7px)',
  width: 6, height: 6, borderRadius: T.radiusPill,
  background: 'var(--wcgw-sev-warning)',
}

const connectionDotStyle = (state: AgentDisplayState, hasIssueCount: boolean): CSSProperties => ({
  position: 'absolute',
  top: 9,
  left: hasIssueCount ? 'calc(50% + 15px)' : 'calc(50% + 8px)',
  width: 6,
  height: 6,
  borderRadius: T.radiusPill,
  background: AGENT_DISPLAY_COLORS[state],
})

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

interface BottomNavProps {
  readonly activeView: ViewTab
  readonly onSelect: (v: ViewTab) => void
  readonly mode: SuggestionMode
  readonly counts: { readonly agent: number; readonly seo: number; readonly aeo: number }
  readonly agentConnectionState: AgentDisplayState
}

export const BottomNav = ({ activeView, onSelect, mode, counts, agentConnectionState }: BottomNavProps) => {
  const activeIndex = TAB_CONFIG.findIndex((tab) => tab.key === activeView)
  const items: readonly TabItem[] = TAB_CONFIG.map((tab) => {
    const count = tab.key === 'agent' ? counts.agent
      : tab.key === 'seo' ? counts.seo
      : tab.key === 'aeo' ? counts.aeo
      : 0
    const labelText = mode === 'vibe' ? tab.vibeLabel : (tab.devTitle ?? tab.label)
    const countLabel = count > 0 ? `${labelText} (${count} issues)` : labelText
    const fullLabel = tab.key === 'agent'
      ? `${countLabel} — ${AGENT_DISPLAY_DESCRIPTIONS[agentConnectionState]}`
      : countLabel
    return {
      key: tab.key,
      title: fullLabel,
      ariaLabel: fullLabel,
      content: (
        <>
          <NavIcon name={tab.key} />
          {count > 0 && <span aria-hidden="true" style={NAV_DOT} />}
          {tab.key === 'agent' && (
            <span
              data-testid="vibe-check-agent-connection-dot"
              data-state={agentConnectionState}
              aria-hidden="true"
              style={connectionDotStyle(agentConnectionState, count > 0)}
            />
          )}
        </>
      ),
    }
  })

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <span data-wcgw-nav-proof aria-hidden="true" style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', zIndex: 1, fontFamily: T.fontMono, fontSize: 8, lineHeight: 1, letterSpacing: '0.1em', color: T.textMuted, pointerEvents: 'none' }}>
        PL {String(activeIndex + 1).padStart(2, '0')}/06
      </span>
      <Tabs
        items={items}
        activeKey={activeView}
        onSelect={(k) => onSelect(k as ViewTab)}
        variant="underline"
        edge="top"
        hairline
        ariaLabel="Views"
        tabStyle={{ padding: '12px 2px 11px', minHeight: 44 }}
        containerStyle={{ paddingTop: 1 }}
      />
    </div>
  )
}
