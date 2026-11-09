import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { T } from '../../tokens.js'

// ── The one tab bar ──────────────────────────────────────────────────────────
// Owns the tab button style, the sliding underline indicator, and tablist/tab
// a11y semantics. Consumed by BottomNav (icon, underline at top) and AgentPanel
// (text, underline at bottom). The `pill` variant (no sliding indicator, active
// gets a faint fill) backs the timescale segmented control. One indicator width,
// one duration token, one radius token — tuning happens here, not in three files.
//
// Keyboard: the WAI-ARIA tabs pattern with automatic activation. Only the
// selected tab is in the Tab order (roving tabIndex); ArrowLeft/ArrowRight wrap,
// Home/End jump. Pass `idBase` + `panelId` when one element shows the selected
// tab's content: each tab gets id `tabId(idBase, key)` and aria-controls, and
// the consumer renders role="tabpanel" with aria-labelledby on that element.

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
  /** Prefix for each tab's id (`tabId(idBase, key)`). */
  readonly idBase?: string
  /** id of the role="tabpanel" element the tabs control. */
  readonly panelId?: string
}

export const tabId = (idBase: string, key: string): string => `${idBase}-tab-${key}`

const NEXT_INDEX: Readonly<Record<string, (current: number, count: number) => number>> = {
  ArrowRight: (current, count) => (current + 1) % count,
  ArrowLeft: (current, count) => (current - 1 + count) % count,
  Home: () => 0,
  End: (_current, count) => count - 1,
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
  ariaLabel, tabStyle, containerStyle, idBase, panelId,
}: TabsProps) => {
  const activeIndex = items.findIndex((t) => t.key === activeKey)
  const focusIndex = activeIndex >= 0 ? activeIndex : 0

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = NEXT_INDEX[event.key]
    if (!next || items.length === 0) return
    event.preventDefault()
    const index = next(activeIndex >= 0 ? activeIndex : 0, items.length)
    const item = items[index]
    if (!item) return
    onSelect(item.key)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus()
  }
  const hairlineStyle: CSSProperties = hairline
    ? { [edge === 'top' ? 'borderTop' : 'borderBottom']: `1px solid ${T.borderSubtle}` }
    : {}

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      style={{ display: 'flex', position: 'relative', flexShrink: 0, ...hairlineStyle, ...containerStyle }}
    >
      {variant === 'underline' && activeIndex >= 0 && (
        <span aria-hidden="true" style={indicatorStyle(activeIndex, items.length, edge)} />
      )}
      {items.map((item, index) => {
        const active = item.key === activeKey
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={idBase ? tabId(idBase, item.key) : undefined}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={index === focusIndex ? 0 : -1}
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
