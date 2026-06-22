import { useState, type CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { getSuggestion, getAgentPrompt } from '@wcgw/vibe-check-core'
import type { TrackedIssue, IssueStatus } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { CopyButton } from './ui/CopyButton.js'
import { Badge } from './ui/Badge.js'

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

const STATUS_STYLES: Record<IssueStatus, { color: string; bg: string; label: string; vibeLabel: string }> = {
  new: { color: '#facc15', bg: 'rgba(250,204,21,0.08)', label: 'NEW', vibeLabel: 'needs fix' },
  'sent-to-agent': { color: 'rgba(var(--vc-fg,255,255,255),0.5)', bg: 'rgba(var(--vc-fg,255,255,255),0.05)', label: 'SENT', vibeLabel: 'sent to AI' },
  resolved: { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', label: 'FIXED', vibeLabel: 'fixed' },
}

type TabKey = 'active' | 'sent' | 'resolved'

const tabStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '11px 0',
  minHeight: 44,
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  textAlign: 'center',
  color: active ? T.text : T.textTertiary,
  background: active ? 'rgba(var(--vc-fg,255,255,255),0.04)' : 'transparent',
  border: 'none',
  borderBottom: active ? `2px solid rgba(var(--vc-fg,255,255,255),0.2)` : '2px solid transparent',
  cursor: 'pointer',
  transition: 'color 0.2s ease, background 0.2s ease, border-color 0.2s ease',
  fontFamily: 'inherit',
  outline: 'none',
})

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
  const [expanded, setExpanded] = useState(false)
  const { issue } = tracked
  const suggestion = getSuggestion(issue, mode)
  const statusConfig = STATUS_STYLES[tracked.status]

  const handleCopyAndMark = async () => {
    const success = await onCopy(suggestion.prompt, issue.id)
    if (success && tracked.status === 'new') {
      onMarkSent(issue.id)
    }
  }

  return (
    <div style={{ padding: '10px 10px', borderBottom: '1px solid rgba(var(--vc-fg,255,255,255),0.05)' }}>
      <div
        onClick={() => setExpanded((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((p) => !p) } }}
        style={{ cursor: 'pointer' }}
      >
        {/* Title — full width, never truncated */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
          marginBottom: 4,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 500, lineHeight: 1.4,
            color: tracked.status === 'resolved' ? 'rgba(var(--vc-fg,255,255,255),0.35)' : 'rgba(var(--vc-fg,255,255,255),0.85)',
            textDecoration: tracked.status === 'resolved' ? 'line-through' : 'none',
          }}>
            {mode === 'vibe' ? suggestion.title : issue.title}
          </span>
          <span style={{
            fontSize: 14, color: 'rgba(var(--vc-fg,255,255,255),0.15)', flexShrink: 0,
            transition: 'transform 0.15s ease',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}>{'\u25BC'}</span>
        </div>
        {/* Meta: severity + status on second line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge severity={issue.severity} />
          <span style={{
            fontSize: 14, fontWeight: 500,
            color: statusConfig.color,
            background: statusConfig.bg,
            padding: '2px 7px', borderRadius: T.radiusXs,
          }}>
            {mode === 'vibe' ? statusConfig.vibeLabel : statusConfig.label}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, animation: 'vc-fade-in 0.15s ease' }}>
          <div style={{
            fontSize: 14, color: 'rgba(var(--vc-fg,255,255,255),0.55)',
            lineHeight: 1.55, marginBottom: 10, paddingLeft: 2,
          }}>
            {suggestion.explanation}
          </div>

          <div style={{
            background: 'rgba(var(--vc-fg,255,255,255),0.02)',
            border: '1px solid rgba(var(--vc-fg,255,255,255),0.06)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 8,
            }}>
              <span style={{
                fontSize: 14, fontWeight: 500,
                color: 'rgba(var(--vc-fg,255,255,255),0.35)',
              }}>
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

          <div style={{ display: 'flex', gap: 6 }}>
            {tracked.status !== 'resolved' && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkResolved(issue.id) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, fontSize: 14, fontWeight: 500,
                  border: '1px solid rgba(74,222,128,0.15)',
                  background: 'rgba(74,222,128,0.06)',
                  color: '#4ade80', cursor: 'pointer',
                  fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease',
                }}
              >
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {mode === 'vibe' ? 'mark as fixed' : 'resolve'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 14, fontWeight: 500, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'rgba(var(--vc-fg,255,255,255),0.4)',
          }}>
            {mode === 'vibe' ? 'AI Fixes' : 'Agent Queue'}
          </span>
          {active.length > 0 && (
            <span style={{
              fontSize: 14, fontWeight: 700, color: 'rgba(var(--vc-fg,255,255,255),0.9)',
              background: 'rgba(var(--vc-fg,255,255,255),0.08)',
              padding: '2px 7px', borderRadius: 6,
            }}>{active.length}</span>
          )}
        </div>

        {currentIssues.length > 0 && (
          <CopyButton
            copied={copiedId === 'all'}
            onClick={handleCopyAll}
            size="sm"
            label={mode === 'vibe' ? 'copy all' : 'copy all prompts'}
          />
        )}
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(var(--vc-fg,255,255,255),0.05)',
        marginBottom: 6,
      }}>
        <button style={tabStyle(activeTab === 'active')} onClick={() => setActiveTab('active')}>
          {mode === 'vibe' ? `to fix (${active.length})` : `active (${active.length})`}
        </button>
        <button style={tabStyle(activeTab === 'sent')} onClick={() => setActiveTab('sent')}>
          sent ({sent.length})
        </button>
        <button style={tabStyle(activeTab === 'resolved')} onClick={() => setActiveTab('resolved')}>
          {mode === 'vibe' ? `fixed (${resolved.length})` : `resolved (${resolved.length})`}
        </button>
      </div>

      {currentIssues.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '16px 12px', borderRadius: 8,
          background: 'rgba(var(--vc-fg,255,255,255),0.02)', border: '1px solid rgba(var(--vc-fg,255,255,255),0.05)',
        }}>
          {activeTab === 'active' && (
            <span data-vc-breathe style={{
              width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
              boxShadow: '0 0 6px rgba(74,222,128,0.4)',
              animation: 'vc-breathe 3s ease-in-out infinite',
            }} />
          )}
          <span style={{ fontSize: 14, color: 'rgba(var(--vc-fg,255,255,255),0.4)', fontWeight: 500 }}>
            {activeTab === 'active'
              ? (mode === 'vibe' ? 'All good! No issues found' : 'No active issues')
              : activeTab === 'sent'
                ? (mode === 'vibe' ? 'No prompts sent yet' : 'No issues in sent queue')
                : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')
            }
          </span>
        </div>
      ) : (
        <div style={{
          maxHeight: 240, overflowY: 'auto', borderRadius: 8,
          background: 'rgba(var(--vc-fg,255,255,255),0.015)', border: '1px solid rgba(var(--vc-fg,255,255,255),0.05)',
        }}>
          {currentIssues.map((t) => (
            <IssueRow
              key={t.issue.id} tracked={t} mode={mode} copiedId={copiedId}
              onCopy={onCopy} onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
            />
          ))}
        </div>
      )}

      {activeTab === 'resolved' && resolved.length > 0 && (
        <button
          onClick={onClearResolved}
          style={{
            width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 6,
            fontSize: 14, fontWeight: 500,
            border: '1px solid rgba(var(--vc-fg,255,255,255),0.06)',
            background: 'rgba(var(--vc-fg,255,255,255),0.02)',
            color: 'rgba(var(--vc-fg,255,255,255),0.35)', cursor: 'pointer',
            fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease',
          }}
        >
          {mode === 'vibe' ? 'clear all fixed issues' : 'clear resolved'}
        </button>
      )}
    </div>
  )
}
