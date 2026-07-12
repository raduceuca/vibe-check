import { useState } from 'react'
import { memo } from 'react'
import type { BeaconStatus, DispatchIssueResponse, SuggestionMode, VibeIssue } from '@wcgw/vibe-check-core'
import { getAgentPrompt } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { getSuggestionCached } from './suggestionCache.js'
import { CopyButton } from './ui/CopyButton.js'
import { Row } from './ui/Row.js'
import { Button } from './ui/Button.js'
import { SectionHeader } from './ui/SectionHeader.js'
import { EmptyState } from './ui/EmptyState.js'
import { Tabs, type TabItem } from './ui/Tabs.js'
import { AgentConnectionStatus } from './AgentConnectionStatus.js'

interface AgentPanelProps {
  readonly tracked: readonly TrackedIssue[]
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onClearResolved: () => void
}

type TabKey = 'active' | 'sent' | 'resolved'

const IssueRow = ({
  tracked,
  mode,
  copiedId,
  onCopy,
  beaconStatus,
  onDispatch,
  onMarkSent,
  onMarkResolved,
}: {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
}) => {
  const [delivery, setDelivery] = useState<DispatchIssueResponse['code'] | 'idle' | 'sending'>('idle')
  const { issue } = tracked
  const suggestion = getSuggestionCached(issue, mode)
  const isResolved = tracked.status === 'resolved'

  const handleCopy = async () => {
    await onCopy(suggestion.prompt, issue.id)
  }

  const canDispatch = beaconStatus?.lastOk === true
    && (beaconStatus.projectStatus?.state === 'watching' || beaconStatus.projectStatus?.state === 'busy')

  const handleDispatch = async () => {
    setDelivery('sending')
    const result = await onDispatch(issue)
    setDelivery(result.code)
    if (result.ok) onMarkSent(issue.id)
  }

  const deliveryLabel: Partial<Record<typeof delivery, string>> = {
    dispatched: 'sent',
    'agent-not-watching': 'agent not watching',
    'queue-full': 'queue full',
    'hub-offline': 'MCP server offline',
    'invalid-issue': 'invalid issue',
    failed: 'send failed',
    unconfigured: 'MCP not configured',
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
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textTertiary }}>
            {mode === 'vibe' ? 'Prompt for your AI' : 'Agent prompt'}
          </span>
          <CopyButton
            copied={copiedId === issue.id}
            onClick={handleCopy}
            label="Copy prompt"
          />
        </div>
        <div style={{
          fontSize: 14, color: T.textTertiary,
          lineHeight: 1.5, maxHeight: 80, overflowY: 'auto',
          fontFamily: T.fontMono,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {suggestion.prompt.slice(0, 300)}{suggestion.prompt.length > 300 ? '…' : ''}
        </div>
      </div>

      {!isResolved && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="sm"
            disabled={!canDispatch || delivery === 'sending' || delivery === 'dispatched'}
            onClick={(e) => { e.stopPropagation(); void handleDispatch() }}
            testId={`vibe-check-send-${issue.id}`}
            title={canDispatch ? 'Send this issue to the connected agent' : 'Connect one agent watcher before sending'}
          >
            {delivery === 'sending' ? 'Sending…' : delivery === 'dispatched' ? 'Sent' : 'Send to agent'}
          </Button>
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
          {delivery !== 'idle' && delivery !== 'sending' && deliveryLabel[delivery] && (
            <span role="status" style={{ color: delivery === 'dispatched' ? T.green : T.red, fontSize: 13 }}>
              {deliveryLabel[delivery]}
            </span>
          )}
        </div>
      )}
    </Row>
  )
}

export const AgentPanel = memo(({
  tracked, mode, copiedId, onCopy, beaconStatus, onDispatch, onMarkSent, onMarkResolved, onClearResolved,
}: AgentPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('active')

  const active = tracked.filter((t) => t.status === 'new')
  const sent = tracked.filter((t) => t.status === 'sent-to-agent')
  const resolved = tracked.filter((t) => t.status === 'resolved')

  const tabIssues: Record<TabKey, readonly TrackedIssue[]> = { active, sent, resolved }
  const currentIssues = tabIssues[activeTab]

  const tabItems: readonly TabItem[] = [
    { key: 'active', content: mode === 'vibe' ? `to fix (${active.length})` : `active (${active.length})` },
    { key: 'sent', content: `sent (${sent.length})` },
    { key: 'resolved', content: mode === 'vibe' ? `fixed (${resolved.length})` : `resolved (${resolved.length})` },
  ]

  const handleCopyAll = async () => {
    const issues = currentIssues.map((t) => t.issue)
    const prompt = getAgentPrompt(issues, mode)
    await onCopy(prompt, 'all')
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <AgentConnectionStatus mode={mode} beaconUrl={beaconStatus?.configured ? 'configured' : undefined} status={beaconStatus} />
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

      <Tabs
        items={tabItems}
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k as TabKey)}
        variant="underline"
        edge="bottom"
        hairline
        ariaLabel="Issue queues"
        tabStyle={{ padding: '8px 0 10px', minHeight: 40 }}
        containerStyle={{ marginBottom: 10 }}
      />

      {currentIssues.length === 0 ? (
        <EmptyState
          showDot={activeTab === 'active'}
          label={activeTab === 'active'
            ? (mode === 'vibe' ? 'All good! No problems found' : 'No active issues')
            : activeTab === 'sent'
              ? (mode === 'vibe' ? 'No prompts sent yet' : 'Nothing sent yet')
              : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')}
        />
      ) : (
        <div>
          {currentIssues.map((t) => (
            <IssueRow
              key={t.issue.id} tracked={t} mode={mode} copiedId={copiedId}
              onCopy={onCopy} beaconStatus={beaconStatus} onDispatch={onDispatch}
              onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
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
})
