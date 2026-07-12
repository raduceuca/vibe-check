import { useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import type { Severity } from '@wcgw/vibe-check-core'
import { T } from '../../tokens.js'
import { SeverityDot } from './Badge.js'
import { Chevron } from './Chevron.js'

// The shared list-row frame — 12px vertical rhythm + a hairline divider. Reused
// by any panel that renders a stack of rows (PromptsPanel) so the treatment lives
// in one place instead of being hand-copied.
export const rowFrame: CSSProperties = {
  padding: '12px 0',
  borderBottom: `1px solid ${T.borderSubtle}`,
}

// One-line list row: severity dot + title + optional trailing slot, with an
// optional expandable body (a chevron appears and the row becomes a toggle when
// `children` is provided). Replaces the near-identical AuditRow / IssueRow.
interface RowProps {
  readonly title: ReactNode
  readonly severity?: Severity
  readonly trailing?: ReactNode
  readonly titleColor?: string
  readonly strikethrough?: boolean
  readonly children?: ReactNode
}

export const Row = ({ title, severity, trailing, titleColor, strikethrough, children }: RowProps) => {
  const [expanded, setExpanded] = useState(false)
  const expandable = children != null
  const toggle = () => setExpanded((p) => !p)

  const headerProps: HTMLAttributes<HTMLDivElement> = expandable
    ? {
        onClick: toggle,
        role: 'button',
        tabIndex: 0,
        'aria-expanded': expanded,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
        },
      }
    : {}

  return (
    <div style={{ borderBottom: `1px solid ${T.borderSubtle}` }}>
      {/* Padding sits on the interactive header (not the outer frame) so the whole
          ~44px band — not just the 20px text line — is the click/hit target. */}
      <div
        {...headerProps}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: expandable ? 'pointer' : 'default', minHeight: 20, padding: '12px 0' }}
      >
        {severity && <SeverityDot severity={severity} />}
        <span style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: titleColor ?? T.text,
          textDecoration: strikethrough ? 'line-through' : 'none',
        }}>
          {title}
        </span>
        {trailing}
        {expandable && <Chevron open={expanded} />}
      </div>

      {expandable && expanded && (
        <div style={{ marginTop: 2, paddingBottom: 12, animation: `vc-fade-in ${T.durationFast} ${T.ease}` }}>
          {children}
        </div>
      )}
    </div>
  )
}
