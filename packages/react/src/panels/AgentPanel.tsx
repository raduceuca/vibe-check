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
  new: { color: 'var(--vc-sev-warning, #facc15)', bg: 'color-mix(in srgb, var(--vc-sev-warning, #facc15) var(--vc-badge-alpha, 14%), transparent)', label: 'NEW', vibeLabel: 'needs fix' },
  'sent-to-agent': { color: 'var(--vc-sev-neutral, rgba(255,255,255,0.5))', bg: 'rgba(var(--vc-fg,255,255,255),0.06)', label: 'SENT', vibeLabel: 'sent to AI' },
  resolved: { color: 'var(--vc-sev-success, #4ade80)', bg: 'color-mix(in srgb, var(--vc-sev-success, #4ade80) var(--vc-badge-alpha, 14%), transparent)', label: 'FIXED', vibeLabel: 'fixed' },
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
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(var(--vc-fg,255,255,255),0.06)' }}>
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
            fontSize: 14, fontWeight: 500, lineHeight: 1.4, textWrap: 'balance',
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
        {/* Meta: severity, plus a status badge only when it adds info beyond the
            current tab (i.e. once sent/resolved — "needs fix" in the to-fix tab
            is redundant). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge severity={issue.severity} />
          {tracked.status !== 'new' && (
            <span style={{
              fontSize: 14, fontWeight: 500,
              color: statusConfig.color,
              background: statusConfig.bg,
              padding: '2px 7px', borderRadius: T.radiusXs,
            }}>
              {mode === 'vibe' ? statusConfig.vibeLabel : statusConfig.label}
            </span>
          )}
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
                  border: '1px solid color-mix(in srgb, var(--vc-sev-success, #4ade80) 22%, transparent)',
                  background: 'color-mix(in srgb, var(--vc-sev-success, #4ade80) 8%, transparent)',
                  color: 'var(--vc-sev-success, #4ade80)', cursor: 'pointer', minHeight: 30,
                  fontFamily: 'inherit', outline: 'none', transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
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
        display: 'flex', position: 'relative', marginBottom: 10,
        boxShadow: 'inset 0 -1px 0 rgba(var(--vc-fg,255,255,255),0.07)',
      }}>
        {/* One underline that slides between the active tab's center */}
        <span aria-hidden="true" style={{
          position: 'absolute', bottom: 0,
          left: `calc((${TAB_INDEX[activeTab]} + 0.5) * (100% / 3))`,
          transform: 'translateX(-50%)',
          width: 24, height: 2, borderRadius: 2, background: T.text,
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0',
        }}>
          {activeTab === 'active' && (
            <span data-vc-breathe style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--vc-sev-success, #4ade80)',
              animation: 'vc-breathe 3s ease-in-out infinite',
            }} />
          )}
          <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
            {activeTab === 'active'
              ? (mode === 'vibe' ? 'All good! No issues found' : 'No active issues')
              : activeTab === 'sent'
                ? (mode === 'vibe' ? 'No prompts sent yet' : 'No issues in sent queue')
                : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')
            }
          </span>
        </div>
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
        <button
          onClick={onClearResolved}
          style={{
            width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 6,
            fontSize: 14, fontWeight: 500,
            border: '1px solid rgba(var(--vc-fg,255,255,255),0.06)',
            background: 'rgba(var(--vc-fg,255,255,255),0.02)',
            color: 'rgba(var(--vc-fg,255,255,255),0.35)', cursor: 'pointer', minHeight: 36,
            fontFamily: 'inherit', outline: 'none', transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
          }}
        >
          {mode === 'vibe' ? 'clear all fixed issues' : 'clear resolved'}
        </button>
      )}
    </div>
  )
}
