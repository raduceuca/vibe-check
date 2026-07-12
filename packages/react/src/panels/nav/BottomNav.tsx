import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { Gauge, Wrench, MagnifyingGlass, Robot, Lightbulb, SlidersHorizontal } from '@phosphor-icons/react'
import { T } from '../../tokens.js'
import { Tabs, type TabItem } from '../ui/Tabs.js'
import type { ViewTab } from '../types.js'

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
}

export const BottomNav = ({ activeView, onSelect, mode, counts }: BottomNavProps) => {
  const items: readonly TabItem[] = TAB_CONFIG.map((tab) => {
    const count = tab.key === 'agent' ? counts.agent
      : tab.key === 'seo' ? counts.seo
      : tab.key === 'aeo' ? counts.aeo
      : 0
    const labelText = mode === 'vibe' ? tab.vibeLabel : (tab.devTitle ?? tab.label)
    return {
      key: tab.key,
      title: labelText,
      ariaLabel: count > 0 ? `${labelText} (${count} issues)` : labelText,
      content: (
        <>
          <NavIcon name={tab.key} />
          {count > 0 && <span aria-hidden="true" style={NAV_DOT} />}
        </>
      ),
    }
  })

  return (
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
  )
}
