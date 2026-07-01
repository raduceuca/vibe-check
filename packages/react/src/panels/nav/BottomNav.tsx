import type { CSSProperties } from 'react'
import { Gauge, Wrench, MagnifyingGlass, Robot, Lightbulb, SlidersHorizontal } from '@phosphor-icons/react'
import { T } from '../../tokens.js'
import type { ViewTab } from '../types.js'

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

const NAV_TAB_ACTIVE: CSSProperties = { ...NAV_TAB_BASE, fontWeight: 600, color: T.text }
const NAV_TAB_INACTIVE: CSSProperties = { ...NAV_TAB_BASE, fontWeight: 500, color: T.textTertiary }
const navTabStyle = (active: boolean): CSSProperties => active ? NAV_TAB_ACTIVE : NAV_TAB_INACTIVE

// Count dot for icon tabs — sits at the upper-right of the centered icon.
const NAV_DOT: CSSProperties = {
  position: 'absolute', top: 9, left: 'calc(50% + 7px)',
  width: 6, height: 6, borderRadius: T.radiusPill,
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

interface BottomNavProps {
  readonly activeView: ViewTab
  readonly onSelect: (v: ViewTab) => void
  readonly counts: { readonly agent: number; readonly seo: number; readonly aeo: number }
}

export const BottomNav = ({ activeView, onSelect, counts }: BottomNavProps) => (
  <div style={{ display: 'flex', flexShrink: 0, position: 'relative', paddingTop: 1 }}>
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
      const count = tab.key === 'agent' ? counts.agent
        : tab.key === 'seo' ? counts.seo
        : tab.key === 'aeo' ? counts.aeo
        : 0
      return (
        <button
          key={tab.key}
          data-wcgw-tab
          style={navTabStyle(active)}
          onClick={() => onSelect(tab.key)}
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
)
