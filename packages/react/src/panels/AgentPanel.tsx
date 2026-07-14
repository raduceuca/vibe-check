import { useState } from 'react'
import { memo } from 'react'
import type {
  BeaconStatus,
  DispatchIssueResponse,
  IssuePhase,
  ProjectWorkflow,
  SuggestionMode,
  TrackedProjectIssue,
  VibeIssue,
} from '@wcgw/vibe-check-core'
import { getAgentPrompt } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { getSuggestionCached } from './suggestionCache.js'
import { IssueActions } from './IssueActions.js'
import { CopyButton } from './ui/CopyButton.js'
import { Row } from './ui/Row.js'
import { Button } from './ui/Button.js'
import { SectionHeader } from './ui/SectionHeader.js'
import { EmptyState } from './ui/EmptyState.js'
import { Tabs, type TabItem } from './ui/Tabs.js'
import { AgentConnectionStatus } from './AgentConnectionStatus.js'
import { IssueProgress } from './IssueProgress.js'

interface AgentPanelProps {
  readonly tracked: readonly TrackedIssue[]
  readonly workflow?: ProjectWorkflow | null
  readonly workflowStale?: boolean
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconUrl?: string
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onRequestVerification?: (issueId: string) => Promise<void>
  readonly onClearResolved: () => void
  readonly onHideFixed?: (issueKeys: readonly string[]) => void
}

type TabKey = 'active' | 'progress' | 'resolved'

interface PanelIssue {
  readonly tracked: TrackedIssue
  readonly workflow: TrackedProjectIssue | null
}

export const queueForPhase = (phase: IssuePhase): TabKey => {
  if (phase === 'fixed') return 'resolved'
  if (phase === 'sent' || phase === 'working' || phase === 'verifying') return 'progress'
  return 'active'
}

const localFromWorkflow = (workflow: TrackedProjectIssue): TrackedIssue => ({
  issue: workflow.issue,
  status: workflow.phase === 'fixed'
    ? 'resolved'
    : queueForPhase(workflow.phase) === 'progress'
      ? 'sent-to-agent'
      : 'new',
  firstSeen: workflow.firstSeenAt,
  lastSeen: workflow.lastSeenAt,
  sentAt: workflow.events.find((event) => event.type === 'sent')?.at ?? null,
  resolvedAt: workflow.events.find((event) => event.type === 'fixed')?.at ?? null,
})

const IssueRow = ({
  tracked,
  mode,
  copiedId,
  onCopy,
  beaconStatus,
  onDispatch,
  onMarkSent,
  onMarkResolved,
  workflow,
  onRequestVerification,
}: {
  readonly tracked: TrackedIssue
  readonly workflow: TrackedProjectIssue | null
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onRequestVerification?: (issueId: string) => Promise<void>
}) => {
  const { issue } = tracked
  const suggestion = getSuggestionCached(issue, mode)
  const isResolved = tracked.status === 'resolved'

  return (
    <Row
      severity={issue.severity}
      title={mode === 'vibe' ? suggestion.title : issue.title}
      titleColor={isResolved ? T.textMuted : undefined}
      strikethrough={isResolved}
    >
      {workflow && <IssueProgress tracked={workflow} mode={mode} />}
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
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.textTertiary }}>
            {mode === 'vibe' ? 'Prompt for your AI' : 'Agent prompt'}
          </span>
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

      <IssueActions
        tracked={tracked}
        mode={mode}
        copiedId={copiedId}
        beaconStatus={beaconStatus}
        onCopy={onCopy}
        onDispatch={onDispatch}
        onMarkSent={onMarkSent}
        onMarkResolved={onMarkResolved}
        workflow={workflow}
        onRequestVerification={onRequestVerification}
      />
    </Row>
  )
}

export const AgentPanel = memo(({
  tracked, workflow = null, workflowStale = false, mode, copiedId, onCopy,
  beaconUrl, beaconStatus, onDispatch, onMarkSent, onMarkResolved,
  onRequestVerification, onClearResolved, onHideFixed,
}: AgentPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('active')

  const panelIssues: readonly PanelIssue[] = workflow
    ? workflow.issues.map((item) => ({ tracked: localFromWorkflow(item), workflow: item }))
    : tracked.map((item) => ({ tracked: item, workflow: null }))
  const queueFor = (item: PanelIssue): TabKey => item.workflow
    ? queueForPhase(item.workflow.phase)
    : item.tracked.status === 'resolved'
      ? 'resolved'
      : item.tracked.status === 'sent-to-agent'
        ? 'progress'
        : 'active'
  const active = panelIssues.filter((item) => queueFor(item) === 'active')
  const progress = panelIssues.filter((item) => queueFor(item) === 'progress')
  const resolved = panelIssues.filter((item) => queueFor(item) === 'resolved')

  const tabIssues: Record<TabKey, readonly PanelIssue[]> = { active, progress, resolved }
  const currentIssues = tabIssues[activeTab]

  const tabItems: readonly TabItem[] = [
    { key: 'active', content: mode === 'vibe' ? `to fix (${active.length})` : `active (${active.length})` },
    { key: 'progress', content: `in progress (${progress.length})` },
    { key: 'resolved', content: mode === 'vibe' ? `fixed (${resolved.length})` : `resolved (${resolved.length})` },
  ]

  const handleCopyAll = async () => {
    const issues = currentIssues.map((item) => item.tracked.issue)
    const prompt = getAgentPrompt(issues, mode)
    await onCopy(prompt, 'all')
  }

  return (
    <div style={{ paddingTop: 4 }}>
      <AgentConnectionStatus mode={mode} beaconUrl={beaconUrl} status={beaconStatus} />
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

      {workflowStale && workflow && (
        <div role="status" style={{ color: T.yellow, fontSize: 12, margin: '-2px 0 8px' }}>
          last known progress — hub offline
        </div>
      )}

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
            : activeTab === 'progress'
              ? (mode === 'vibe' ? 'Nothing in progress yet' : 'No agent work in progress')
              : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')}
        />
      ) : (
        <div>
          {currentIssues.map((item) => (
            <IssueRow
              key={item.workflow?.issueKey ?? item.tracked.issue.id}
              tracked={item.tracked} workflow={item.workflow} mode={mode} copiedId={copiedId}
              onCopy={onCopy} beaconStatus={beaconStatus} onDispatch={onDispatch}
              onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
              onRequestVerification={onRequestVerification}
            />
          ))}
        </div>
      )}

      {activeTab === 'resolved' && resolved.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              if (workflow && onHideFixed) {
                onHideFixed(resolved.flatMap((item) => item.workflow?.issueKey ?? []))
              } else {
                onClearResolved()
              }
            }}
          >
            {mode === 'vibe' ? 'clear all fixed issues' : 'clear resolved'}
          </Button>
        </div>
      )}
    </div>
  )
})
