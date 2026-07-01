import { useState, type CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { getSuggestion, getAgentPrompt } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { CopyButton } from './ui/CopyButton.js'
import { Row } from './ui/Row.js'
import { Button } from './ui/Button.js'
import { SectionHeader } from './ui/SectionHeader.js'
import { EmptyState } from './ui/EmptyState.js'

interface AgentPanelProps {
  readonly tracked: readonly TrackedIssue[]
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkSentBatch: (issueIds: readonly string[]) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onClearResolved: () => void
}

type TabKey = 'active' | 'sent' | 'resolved'

// Borderless segmented control — text only, a single underline slides between
// tabs on a faint track. Matches the bottom-nav language; no boxy active fill.
const segTabStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '8px 0 10px',
  minHeight: 40,
  fontSize: 14,
  fontWeight: active ? 600 : 500,
  textAlign: 'center',
  color: active ? T.text : T.textTertiary,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 0.2s ease',
  fontFamily: 'inherit',
  outline: 'none',
})

const TAB_INDEX: Record<TabKey, number> = { active: 0, sent: 1, resolved: 2 }

const IssueRow = ({
  tracked,
  mode,
  copiedId,
  onCopy,
  onMarkSent,
  onMarkResolved,
}: {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
}) => {
  const { issue } = tracked
  const suggestion = getSuggestion(issue, mode)
  const isResolved = tracked.status === 'resolved'

  const handleCopyAndMark = async () => {
    const success = await onCopy(suggestion.prompt, issue.id)
    if (success && tracked.status === 'new') {
      onMarkSent(issue.id)
    }
  }

  return (
    <Row
      severity={issue.severity}
      title={mode === 'vibe' ? suggestion.title : issue.title}
      titleColor={isResolved ? T.textMuted : undefined}
      strikethrough={isResolved}
    >
      <div style={{
        fontSize: 14, color: T.textTertiary,
        lineHeight: 1.55, marginBottom: 10, paddingLeft: 2,
      }}>
        {suggestion.explanation}
      </div>

      <div style={{
        background: T.bgSubtle,
        border: `1px solid ${T.borderSubtle}`,
        borderRadius: T.radiusMd, padding: '10px 12px', marginBottom: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textMuted }}>
            {mode === 'vibe' ? 'Prompt for your AI' : 'Agent prompt'}
          </span>
          <CopyButton
            copied={copiedId === issue.id}
            onClick={handleCopyAndMark}
            label={tracked.status === 'new' ? 'copy & send' : 'copy'}
          />
        </div>
        <div style={{
          fontSize: 14, color: T.textTertiary,
          lineHeight: 1.5, maxHeight: 80, overflowY: 'auto',
          fontFamily: T.fontMono,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {suggestion.prompt.slice(0, 300)}{suggestion.prompt.length > 300 ? '...' : ''}
        </div>
      </div>

      {!isResolved && (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button
            variant="success"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMarkResolved(issue.id) }}
            icon={(
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          >
            {mode === 'vibe' ? 'mark as fixed' : 'resolve'}
          </Button>
        </div>
      )}
    </Row>
  )
}

export const AgentPanel = ({
  tracked, mode, copiedId, onCopy, onMarkSent, onMarkSentBatch, onMarkResolved, onClearResolved,
}: AgentPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('active')

  const active = tracked.filter((t) => t.status === 'new')
  const sent = tracked.filter((t) => t.status === 'sent-to-agent')
  const resolved = tracked.filter((t) => t.status === 'resolved')

  const tabIssues: Record<TabKey, readonly TrackedIssue[]> = { active, sent, resolved }
  const currentIssues = tabIssues[activeTab]

  const handleCopyAll = async () => {
    const issues = currentIssues.map((t) => t.issue)
    const prompt = getAgentPrompt(issues, mode)
    await onCopy(prompt, 'all')
    const newIds = currentIssues
      .filter((t) => t.status === 'new')
      .map((t) => t.issue.id)
    if (newIds.length > 0) {
      onMarkSentBatch(newIds)
    }
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <SectionHeader
        count={active.length}
        action={currentIssues.length > 0 ? (
          <CopyButton
            copied={copiedId === 'all'}
            onClick={handleCopyAll}
            size="sm"
            label={mode === 'vibe' ? 'copy all' : 'copy all prompts'}
          />
        ) : undefined}
      >
        {mode === 'vibe' ? 'AI Fixes' : 'Agent Queue'}
      </SectionHeader>

      <div style={{
        display: 'flex', position: 'relative', marginBottom: 10,
        boxShadow: 'inset 0 -1px 0 rgba(var(--wcgw-fg),0.07)',
      }}>
        {/* One underline that slides between the active tab's center */}
        <span aria-hidden="true" style={{
          position: 'absolute', bottom: 0,
          left: `calc((${TAB_INDEX[activeTab]} + 0.5) * (100% / 3))`,
          transform: 'translateX(-50%)',
          width: 24, height: 2, borderRadius: T.radiusPill, background: T.text,
          transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }} />
        <button style={segTabStyle(activeTab === 'active')} onClick={() => setActiveTab('active')}>
          {mode === 'vibe' ? `to fix (${active.length})` : `active (${active.length})`}
        </button>
        <button style={segTabStyle(activeTab === 'sent')} onClick={() => setActiveTab('sent')}>
          sent ({sent.length})
        </button>
        <button style={segTabStyle(activeTab === 'resolved')} onClick={() => setActiveTab('resolved')}>
          {mode === 'vibe' ? `fixed (${resolved.length})` : `resolved (${resolved.length})`}
        </button>
      </div>

      {currentIssues.length === 0 ? (
        <EmptyState
          showDot={activeTab === 'active'}
          label={activeTab === 'active'
            ? (mode === 'vibe' ? 'All good! No issues found' : 'No active issues')
            : activeTab === 'sent'
              ? (mode === 'vibe' ? 'No prompts sent yet' : 'No issues in sent queue')
              : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')}
        />
      ) : (
        <div>
          {currentIssues.map((t) => (
            <IssueRow
              key={t.issue.id} tracked={t} mode={mode} copiedId={copiedId}
              onCopy={onCopy} onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
            />
          ))}
        </div>
      )}

      {activeTab === 'resolved' && resolved.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button variant="ghost" fullWidth onClick={onClearResolved}>
            {mode === 'vibe' ? 'clear all fixed issues' : 'clear resolved'}
          </Button>
        </div>
      )}
    </div>
  )
}
