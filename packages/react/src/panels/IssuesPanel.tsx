import { useState, type CSSProperties } from 'react'
import type { VibeIssue } from '@wcgw/vibe-check-core'
import { Panel } from './ui/Panel.js'
import { Badge } from './ui/Badge.js'

interface IssuesPanelProps {
  readonly issues: readonly VibeIssue[]
}

const emptyStyle: CSSProperties = {
  fontSize: 11,
  color: '#4ade80',
  padding: '2px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const emptyDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  backgroundColor: '#4ade80',
  boxShadow: '0 0 4px rgba(74, 222, 128, 0.4)',
}

const issueRowStyle: CSSProperties = {
  padding: '5px 0',
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  cursor: 'pointer',
}

const issueHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
}

const issueTitleStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.7)',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const descriptionStyle: CSSProperties = {
  fontSize: 10,
  color: 'rgba(255, 255, 255, 0.4)',
  marginTop: 4,
  paddingLeft: 2,
  lineHeight: 1.5,
}

const expandIconStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.2)',
  fontSize: 8,
  flexShrink: 0,
}

const IssueRow = ({ issue }: { readonly issue: VibeIssue }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={issueRowStyle}
      onClick={() => setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((prev) => !prev)
        }
      }}
    >
      <div style={issueHeaderStyle}>
        <Badge severity={issue.severity} />
        <span style={issueTitleStyle}>{issue.title}</span>
        <span style={expandIconStyle}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded ? (
        <div style={descriptionStyle}>{issue.description}</div>
      ) : null}
    </div>
  )
}

const titleWithCount = (count: number): string =>
  count === 0 ? 'Issues' : `Issues (${count})`

export const IssuesPanel = ({ issues }: IssuesPanelProps) => (
  <Panel title={titleWithCount(issues.length)} borderTop>
    {issues.length === 0 ? (
      <div style={emptyStyle}>
        <span style={emptyDotStyle} />
        All clear
      </div>
    ) : (
      issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
    )}
  </Panel>
)
