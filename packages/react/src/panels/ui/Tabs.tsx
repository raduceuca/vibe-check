import type { CSSProperties, ReactNode } from 'react'
import { T } from '../../tokens.js'

// ── The one tab bar ──────────────────────────────────────────────────────────
// Owns the tab button style, the sliding underline indicator, and tablist/tab
// a11y semantics. Consumed by BottomNav (icon, underline at top) and AgentPanel
// (text, underline at bottom). The `pill` variant (no sliding indicator, active
// gets a faint fill) backs the timescale segmented control. One indicator width,
// one duration token, one radius token — tuning happens here, not in three files.

export interface TabItem {
  readonly key: string
  readonly content: ReactNode
  readonly title?: string
  readonly ariaLabel?: string
}

interface TabsProps {
  readonly items: readonly TabItem[]
  readonly activeKey: string
  readonly onSelect: (key: string) => void
  readonly variant?: 'underline' | 'pill'
  // Which edge the underline + hairline sit on (underline variant only).
  readonly edge?: 'top' | 'bottom'
  // Draw a border-subtle hairline along `edge` (gives the indicator an edge and
  // stops scroll content looking guillotined).
  readonly hairline?: boolean
  // Tabs stretch to fill the row (flex: 1). Off for the auto-width timescale pills.
  readonly fill?: boolean
  readonly ariaLabel?: string
  // Extra per-tab style (padding, min-height) merged into every tab button.
  readonly tabStyle?: CSSProperties
  readonly containerStyle?: CSSProperties
}

const INDICATOR_WIDTH = 20

const tabButtonBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 14,
  position: 'relative',
  transition: `color ${T.durationNormal} ${T.ease}, background ${T.durationFast} ${T.ease}, scale ${T.durationFast} ${T.ease}`,
}

const tabButtonStyle = (active: boolean, variant: 'underline' | 'pill', fill: boolean): CSSProperties => ({
  ...tabButtonBase,
  flex: fill ? 1 : undefined,
  fontWeight: active ? 600 : 500,
  color: active ? T.text : T.textTertiary,
  ...(variant === 'pill'
    ? {
        padding: '3px 8px',
        minHeight: 40,
        borderRadius: T.radiusSm,
        background: active ? 'rgba(var(--wcgw-fg),0.07)' : 'transparent',
      }
    : {}),
})

const indicatorStyle = (
  index: number,
  count: number,
  edge: 'top' | 'bottom',
): CSSProperties => ({
  position: 'absolute',
  [edge]: 0,
  left: `calc((${index} + 0.5) * (100% / ${count}))`,
  transform: 'translateX(-50%)',
  width: INDICATOR_WIDTH,
  height: 2,
  borderRadius: T.radiusPill,
  background: T.text,
  transition: `left ${T.durationNormal} ${T.ease}`,
})

export const Tabs = ({
  items, activeKey, onSelect,
  variant = 'underline', edge = 'bottom', hairline = false, fill = true,
  ariaLabel, tabStyle, containerStyle,
}: TabsProps) => {
  const activeIndex = items.findIndex((t) => t.key === activeKey)
  const hairlineStyle: CSSProperties = hairline
    ? { [edge === 'top' ? 'borderTop' : 'borderBottom']: `1px solid ${T.borderSubtle}` }
    : {}

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      style={{ display: 'flex', position: 'relative', flexShrink: 0, ...hairlineStyle, ...containerStyle }}
    >
      {variant === 'underline' && activeIndex >= 0 && (
        <span aria-hidden="true" style={indicatorStyle(activeIndex, items.length, edge)} />
      )}
      {items.map((item) => {
        const active = item.key === activeKey
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            data-wcgw-tab
            title={item.title}
            aria-label={item.ariaLabel}
            onClick={() => onSelect(item.key)}
            style={tabStyle ? { ...tabButtonStyle(active, variant, fill), ...tabStyle } : tabButtonStyle(active, variant, fill)}
          >
            {item.content}
          </button>
        )
      })}
    </div>
  )
}
